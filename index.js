const error = require('./src/error');

const SearchQueryBuilder = require('./src/SearchQueryBuilder');
const { UnknownPropertyError } = require('./src/error');

/**
 * Creates the remote hook.
 *
 * @todo:   add a configuration scheme that makes sense
 * @todo:   do a check first if the query tries to access relations to avoid the additional db query
 * @todo:   check if we could add a caching strategy for the sql generation
 *          we could use the model and the stringified query as a key, invalidation would not be a problem
 * @todo:   check if we could add a caching strategy for the query results (this is hard in terms of invalidation)
 * @todo:   check how to properly ensure that the corresponding data source supports searching
 *          (i.e. add config on datasource level)
 * @todo:   create meaningful error messages (on startup, and at run-time)
 *
 * @param model
 * @param models
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
                err.status = 409;
            }
            next(err);
        }
    };
}

function getWhereFilter(context = {}) {
    const args = context.args;
    const filter = args ? args.filter : null;
    return filter ? filter.where : null;
}

function getSearchSettings(model, componentSettings = {}) {
    const modelSettings = model.definition.settings.relationFilter || {};
    return Object.assign({}, componentSettings, modelSettings);
}

module.exports = function(loopbackApp, settings) {

    Object
        .keys(loopbackApp.models)
        .forEach((modelName) => {

            const model = loopbackApp.models[modelName];
            const searchConfig = getSearchSettings(model, settings);

            if (searchConfig.enabled === true) {
                model.beforeRemote('find', extendedFindQuery(model, loopbackApp.models, searchConfig));
                model.beforeRemote('findOne', extendedFindQuery(model, loopbackApp.models, searchConfig));
            }
        });
};


module.exports.error = error;
