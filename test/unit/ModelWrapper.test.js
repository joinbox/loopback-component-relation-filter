const { expect } = require('chai');
const { describe, it } = require('mocha');

const ModelWrapper = require('../../src/ModelWrapper');

class MockModel {
    constructor(modelName) {
        this.modelName = modelName;
        this.dataSource = {
            connector: {
                table(nameOfModel) {
                    return nameOfModel;
                },
                schema() {
                    return 'test';
                },
            },
        };
    }
}

describe('The ModelWrapper class', () => {

    describe('ModelWrapper.constructor(model, alias)', () => {
        it('can be instantiated by passing a model and an optional alias', () => {
            const model = new MockModel();
            const wrapper = new ModelWrapper(model, 'test');
            expect(wrapper).to.be.instanceOf(ModelWrapper);
        });
    });

    describe('ModelWrapper.getColumnName(key, options = {})', () => {

        it('resolves the fully qualified column name (if no alias is given)', () => {
            const model = new MockModel('TestModel');
            const wrapper = new ModelWrapper(model);

            expect(wrapper.getColumnName('date')).to.be.equal('test.TestModel.date');
        });

        it('overrides the table name given by the connector by the alias passed in the constructor', () => {
            const model = new MockModel();
            const wrapper = new ModelWrapper(model, 'test');

            expect(wrapper.getColumnName('date')).to.be.equal('test.date');
        });

        it('allows overriding the alias by passing it via options', () => {
            const model = new MockModel();
            const wrapper = new ModelWrapper(model, 'test');

            expect(wrapper.getColumnName('date', { alias: 'aliased' })).to.be.equal('aliased.date');
        });

        it('preserves the case of the colum name by default', () => {
            const model = new MockModel('TestModel');
            const wrapper = new ModelWrapper(model, 'test');
            expect(wrapper.getColumnName('startDate')).to.be.equal('test.startDate');
        });

        it('converts the column name to lower case if the "preserveCase" option is set to false', () => {
            const model = new MockModel('TestModel');
            const preserveCase = false;
            const wrapper = new ModelWrapper(model, 'test');

            expect(wrapper.getColumnName('startDate', { preserveCase })).to.be.equal('test.startdate');
        });

    });
});
