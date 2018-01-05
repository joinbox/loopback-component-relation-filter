module.exports = class ModelWrapper {

    constructor(model, alias) {
        this.model = model;
        this.connector = this.wrapConnector(model);
        this.alias = alias;
    }

    wrapConnector(model) {
        return model.dataSource.connector;
    }

    getTable() {
        const schema = this.getSchema();
        const table = this.getTableName();
        return `${schema}.${table}`;
    }

    getTableName() {
        return this.connector.table(this.getModelName());
    }

    getSchema() {
        return this.connector.schema(this.getModelName()) || 'public';
    }

    getFullyQualifiedTable() {
        return this.getTable();
    }

    getAliasedTable() {
        const alias = this.alias ? ` as ${this.alias}` : '';
        return `${this.getFullyQualifiedTable()}${alias}`;
    }

    getColumnName(key, options = {}) {
        const tableName = options.alias || this.alias || this.getTable();
        // the to lower case is a problem of loopbacks generators
        return `${tableName}.${key.toLowerCase()}`;
    }

    getModelName() {
        return this.model.modelName;
    }

    getConnectorName() {
        return this.connector.name;
    }

    getModelProperties() {
        return this.model.definition.properties;
    }

    getModelRelations() {
        return this.model.relations || {};
    }

    getRelation(name) {
        return this.getModelRelations()[name];
    }

    getPropertyQueriedThrough(relation) {

        if (relation.modelTo.modelName !== this.model.modelName) return null;
        if (!!relation.modelThrough || !!relation.modelTo) return null;

        const reverseRelation = this._toArray(this.getModelRelations())
            .find(rel => rel.modelThrough.modelName === relation.modelThrough.modelName
            && rel.modelTo.modelName === relation.modelFrom.modelName);

        if (reverseRelation) {
            return reverseRelation.keyFrom;
        }
        return null;

    }

    _toArray(obj) {
        return Object
            .keys(obj)
            .map(key => obj[key]);
    }

    getQueriedRelations(where = {}) {
        return this._toArray(this.getModelRelations())
            .reduce((queriedRelations, relation) => {
                if (where[relation.name]) {
                    queriedRelations.push(relation);
                }
                return queriedRelations;
            }, []);
    }

    getIdProperties(options = {}) {
        // return the ids as an array for backwards compatibility
        const idName = this.model.getIdName();
        const ids = [idName];
        if (options.ignoreAlias === true) {
            return ids;
        }
        return ids.map(id => this.getColumnName(id, options));
    }

    isExpression(propertyName) {
        return propertyName === 'and' || propertyName === 'or';
    }

    isProperty(propertyName) {
        return Object.prototype.hasOwnProperty.call(this.getModelProperties(), propertyName);
    }

    isRelation(propertyName) {
        return Object.prototype.hasOwnProperty.call(this.getModelRelations(), propertyName);
    }

    getQueriedProperties(query = {}) {
        return Object
            .keys(query)
            .filter(propertyName => this.isProperty(propertyName))
            .map(propertyName => ({
                key: this.getColumnName(propertyName),
                value: query[propertyName],
            }));
    }

    getName() {
        return this.model.modelName;
    }

    getQueriedExpressions(query = {}) {
        return [];
        return Object.keys(query).filter(propertyName => this.isExpression(propertyName));
    }

    as(alias) {
        return new ModelWrapper(this.model, alias);
    }

    static fromModel(model, alias = null) {
        return new ModelWrapper(model, alias);
    }
};
