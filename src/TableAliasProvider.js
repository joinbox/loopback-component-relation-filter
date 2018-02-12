module.exports = class TableAliasProvider {
    constructor(aliases = {}, separator = '_') {
        this.aliases = aliases;
        this.separator = separator;
    }

    createAlias(model, relation, { through } = {}) {
        const key = this.createKey(model, relation, through);
        const count = this.updateAndGetAliasCount(key);
        return this.appendCount(key, count);
    }

    joinSegments(...segments) {
        // This seems to be necessary due to the auto generation
        // of the models which does not seem to preserve cases
        return segments
            .filter(Boolean)
            .map(entry => entry.toString().toLowerCase())
            .join(this.separator);
    }

    appendCount(key, count) {
        return this.joinSegments(key, count);
    }

    updateAndGetAliasCount(key) {
        if (!this.hasAlias(key)) {
            this.aliases[key] = -1;
        }
        this.aliases[key] = this.aliases[key] + 1;
        return this.aliases[key];
    }

    hasAlias(key) {
        return Object.prototype.hasOwnProperty.call(this.aliases, key);
    }

    createKey(model, relation, through = null) {
        return this.joinSegments(model, through, relation);
    }

    /**
     * Creates a new provider instance with the same state.
     *
     * @return {TableAliasProvider}
     */
    spawnProvider(){
        const aliases = Object.assign({}, this.aliases);
        return new TableAliasProvider(aliases, this.separator);
    }
};
