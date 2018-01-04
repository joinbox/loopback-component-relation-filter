const error = require('./src/error');

const SearchQueryBuilder = require('./src/SearchQueryBuilder');
const { UnknownPropertyError } = require('./src/error');

/**
 * Loopback component that allows filtering over related models using the where filter.
 */
module.exports = function(loopbackApp, settings) {

    Object
        .values(loopbackApp.models)
        .forEach((model) => {

            const searchConfig = getSearchSettings(model, settings);

            if (searchConfig.enabled === true) {
                model.beforeRemote('find', extendedFindQuery(model, loopbackApp.models, searchConfig));
                model.beforeRemote('findOne', extendedFindQuery(model, loopbackApp.models, searchConfig));
            }

        });
};

// Export the component specific error classes.
module.exports.error = error;

/**
 * Creates the function which is invoked for the 'find' and 'findOne' remote hook of loopback.
 *
 * For more information on remote hooks see https://loopback.io/doc/en/lb3/Remote-hooks.html
 *
 * @param model a loopback model
 * @param models the loopback models object
 * @returns {Function}
 */
function extendedFindQuery(model, models, { rejectUnknownProperties = false } = {}) {
    return function(ctx, unused, next) {

        const originalWhere = getWhereFilter(ctx);
        if (!originalWhere) {
            return next();
        }

        const builder = new SearchQueryBuilder(models, { rejectUnknownProperties });
        const query = Object.assign({}, originalWhere);

        try {
            const databaseQuery = builder.buildQuery(model.modelName, { where: query });
            model.dataSource.connector.execute(databaseQuery.toString(), (err, result) => {
                if (err) {
                    return next(err);
                }
                const [first] = result;
                const [idProperty] = Object.keys(first);
                const whereIn = {
                    inq: result.map(entry => entry[idProperty]),
                };

                if (query[idProperty]) {
                    // @todo: this does not make too much sense, add test and fix it!
                    const and = originalWhere.and || [];
                    and.push({ [idProperty]: query[idProperty] });
                    and.push({ [idProperty]: whereIn });
                } else {
                    originalWhere[idProperty] = whereIn;
                }

                next();
            });
        } catch (err) {
            if (err instanceof UnknownPropertyError) {
                err.status = 400;
            }
            next(err);
        }
    };
}

/**
 * Returns the filter query (either sent via API or remote method invocation).
 *
 * @param context the loopback request context
 * @returns {null}
 */
function getWhereFilter(context = {}) {
    const args = context.args;
    const filter = args ? args.filter : null;
    return filter ? filter.where : null;
}

/**
 * Gets the relationFilter settings from the models configuration (setting) and merges
 * them with the basic component settings.
 *
 * @param model a loopback model
 * @param componentSettings general settings of the component
 * @returns {*}
 */
function getSearchSettings(model, componentSettings = {}) {
    const modelSettings = model.definition.settings.relationFilter || {};
    return Object.assign({}, componentSettings, modelSettings);
}
