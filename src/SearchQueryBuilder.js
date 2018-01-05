const knex = require('knex');

const ModelWrapper = require('./ModelWrapper');
const TableAliasProvider = require('./TableAliasProvider');
const SearchQueryNormalizer = require('./SearchQueryNormalizer');

/**
 * @todo: remove the state by instantiating a new table alias provider
 * @todo: remove all methods that should not belong to the interface (i.e. only preserve buildQuery or build)
 *
 * @type {module.SearchQueryBuilder}
 */

module.exports = class SearchQueryBuilder {

    constructor(models, { rejectUnknownProperties = false } = {}) {
        this.models = models;
        this._supportedClients = {
            postgresql: 'pg',
        };
        this.aliases = new TableAliasProvider();
        this.supportedOperators = [
            '=',
            'neq',
            'lt',
            'lte',
            'gt',
            'gte',
            'like',
            'nlike',
            'ilike',
            'nilike',
            'inq',
            'nin',
            'between',
        ];
        const options = {
            supportedOperators: this.supportedOperators,
            rejectUnknownProperties,
        };
        this.normalizer = new SearchQueryNormalizer(models, options);
    }

    getQueryBuilder(wrappedModel) {
        const client = this.getClientName(wrappedModel);
        return knex({ client });
    }

    getClientName(model) {
        const connectorName = model.getConnectorName();
        return this._supportedClients[connectorName];
    }

    // this is currently too complex, since the normalized where will only contain an and query
    queryRelationsAndProperties(builder, rootModel, where = {}) {

        const andQueries = where.and || [];
        const orQueries = where.or || [];

        const relationsToJoin = this.getAllQueriedRelations(rootModel, andQueries, orQueries);
        const aliasedRelations = this.applyJoins(rootModel, relationsToJoin, builder);

        this.handleAndQueries(rootModel, andQueries, builder, aliasedRelations);
        this.handleOrQueries(rootModel, orQueries, builder, aliasedRelations);

        return builder;
    }

    getAllQueriedRelations(model, andQueries = [], orQueries = []) {
        const relations = {};

        andQueries
            .concat(orQueries)
            .forEach((query) => {
                const modelRelations = model.getQueriedRelations(query);
                modelRelations.forEach((relation) => {
                    relations[relation.name] = relation;
                });
            });

        return Object.keys(relations).map(name => relations[name]);
    }

    handleQueryCollection(model, queries, builder, aliasedRelationModels, isOr = false) {
        queries.forEach((query) => {
            Object
                .keys(query)
                .forEach((property) => {
                    // we need to restore the query builder after each property, eek!
                    const queryBuilder = isOr ? builder.or : builder;
                    if (model.isProperty(property)) {
                        const propertyFilter = {
                            property: model.getColumnName(property),
                            value: query[property],
                        };
                        this.applyPropertyFilter(propertyFilter, queryBuilder);
                    } else if (model.isRelation(property)) {
                        const targetModel = aliasedRelationModels[property];
                        this.queryRelationsAndProperties(queryBuilder, targetModel, query[property]);
                    } else if (property === 'or') {
                        this.handleOrQueries(model, query.or, queryBuilder, aliasedRelationModels);
                    } else if (property === 'and') {
                        this.handleAndQueries(model, query.and, queryBuilder, aliasedRelationModels);
                    }
                });
        });
    }

    handleAndQueries(model, andQueries, builder, aliasedRelationModels) {
        // we do not know when the callback is executed, so we might not be able to track the aliases
        // properly?
        builder.andWhere((subQueryBuilder) => {
            this.handleQueryCollection(model, andQueries, subQueryBuilder, aliasedRelationModels);
        });
    }

    handleOrQueries(model, orQueries, builder, aliasedRelationModels) {
        // we do not know when the callback is executed, so we might not be able to track the aliases
        // properly?
        builder.orWhere((subQueryBuilder) => {
            this.handleQueryCollection(model, orQueries, subQueryBuilder.or, aliasedRelationModels, true);
        });
    }

    applyPropertyFilter({ property, value }, builder) {

        if (!value) return;
        const operatorMap = {
            neq: '!=',
            gt: '>',
            lt: '<',
            gte: '>=',
            lte: '<=',
            like: 'like',
            ilike: 'ilike',
            nlike: 'not like',
            nilike: 'not ilike',

        };
        const operator = this.supportedOperators.find((op) => {
            return Object.prototype.hasOwnProperty.call(value, op);
        });

        if (operator) {
            const content = value[operator];
            switch (operator) {
                case '=':
                    return builder.where(property, content);
                case 'neq':
                case 'gt':
                case 'lt':
                case 'gte':
                case 'lte':
                case 'like':
                case 'ilike':
                case 'nlike':
                case 'nilike': {
                    const mappedOperator = operatorMap[operator];
                    return builder.where(property, mappedOperator, content)
                }
                case 'between':
                    return builder.whereBetween(property, content);
                case 'inq':
                    return builder.whereIn(property, content);
                case 'nin':
                    return builder.whereNotIn(property, content);
                default:
            }
        }
        // @todo: throw an error? silently ignore it?
    }

    applyJoins(rootModel, relationsToJoin, builder) {

        return relationsToJoin.reduce((aliasedModels, relation) => {

            const throughModel = relation.modelThrough;
            const toAlias = this.createAlias(rootModel.getName(), relation);
            const modelToQuery = ModelWrapper.fromModel(relation.modelTo, toAlias);

            aliasedModels[relation.name] = modelToQuery;

            // belongs to and has many without through model work exactly the same
            if (!throughModel) {
            // pure has many or belongTo
                this.joinEntities(relation, rootModel, modelToQuery, builder);
            } else {
            // @todo: move this into a method to reduce complexity
                const throughAlias = this.createAlias(rootModel.getName(), relation, true);
                const modelThroughQuery = ModelWrapper.fromModel(throughModel, throughAlias);

                // two joins required: one on the through model, one on the to model
                this.joinEntities(relation, rootModel, modelThroughQuery, builder);

                const [targetModelId] = modelToQuery.getIdProperties({ ignoreAlias: true });
                const relationTargetProperty = modelToQuery.getPropertyQueriedThrough(relation);

                const virtualRelation = {
                    keyFrom: relation.keyThrough,
                    keyTo: relationTargetProperty || targetModelId,
                };

                this.joinEntities(virtualRelation, modelThroughQuery, modelToQuery, builder);
            }
            return aliasedModels;
        }, {});
    }

    createRootQuery(builder, rootModel, filter = {}) {

        const [id] = rootModel.getIdProperties();
        const tableName = rootModel.getAliasedTable();

        const basicSelect = builder(tableName).select(id).groupBy(id);
        if (!filter.where) {
            return basicSelect;
        }

        const where = this.normalizer.normalizeQuery(rootModel.getName(), filter.where || {});
        return this.queryRelationsAndProperties(basicSelect, rootModel, where);
    }

    joinEntities({ keyFrom, keyTo }, fromQuery, toQuery, builder) {
        const fromKey = fromQuery.getColumnName(keyFrom);
        const toKey = toQuery.getColumnName(keyTo);

        builder.join(toQuery.getAliasedTable(), { [fromKey]: toKey });
    }

    createAlias(model, relation = null, forThrough = false) {
        const relationName = relation ? relation.name : null;
        let through;

        if (forThrough && relation) {
            const modelThrough = relation.modelThrough || {};
            through = modelThrough.modelName;
        }

        return this.aliases.createAlias(model, relationName, { through });
    }

    buildQuery(modelName, filter) {
        const rootModelAlias = this.createAlias(modelName);
        const rootModel = this.normalizer.getWrappedModel(modelName).as(rootModelAlias);
        const builder = this.getQueryBuilder(rootModel);

        return this.createRootQuery(builder, rootModel, filter);
    }
};
