const { expect } = require('chai');

const {
    before, beforeEach, describe, it,
} = require('mocha');

const SearchQueryNormalizer = require('../../src/SearchQueryNormalizer');
const { UnknownPropertyError } = require('../../src/error');

describe('The Search Query Normalizer', () => {

    before('basic setup', function() {
        this.model = 'Book';
        this.normalize = (model, query) => this.normalizer.normalizeWhereQuery(model, query);
    });

    beforeEach(function() {
        this.normalizer = new SearchQueryNormalizer(this.models);
    });

    it('adds the equality operator if no operator was specified', function() {
        const newWhere = this.normalize('Book', {
            title: 'Halo',
        });

        expect(newWhere)
            .to.have.property('and')
            .that.deep.equals([
                {
                    title: {
                        '=': 'Halo',
                    },
                },
            ]);
    });

    it('groups all properties and relations together to an and query and filters non existing properties', function() {
        const newWhere = this.normalize('Book', {
            title: 'Halo',
            authors: {
                firstname: 'Michael',
            },
            ratings: {
                stars: 5,
            },
            test: 'fake',
        });

        expect(newWhere).to.have.property('and').that.has.length(2);
    });


    it('throws an error if an unknown property of a model is encountered and ' +
        'the corresponding option is set to true', function() {
        this.normalizer.setUnknownPropertyRejection(true);
        expect(() => {
            this.normalize('Book', {
                test: 'fake',
            });
        }).to.throw(UnknownPropertyError);
    });


    it('throws an error if an unknown property of a related model is encountered and ' +
        'the corresponding option is set to true', function() {
        this.normalizer.setUnknownPropertyRejection(true);
        expect(() => {
            this.normalize('Book', {
                authors: {
                    test: 'fake property',
                },
            });
        }).to.throw(UnknownPropertyError);
    });



    it('groups all properties, relations and existing and queries to an and query', function() {
        const query = {
            title: 'Halo',
            authors: {
                firstName: 'Michael',
                and: [
                    {
                        lastName: {
                            like: 'Rü%',
                        },
                    },
                ],
            },
            and: [
                {
                    id: { gt: 100 },
                    title: { like: 'halo%' },
                },
                {
                    id: { lt: 200 },
                },
            ],
        };
        const newWhere = this.normalizer.normalizeWhereQuery(this.model, query);
        expect(newWhere).to.have.property('and').that.has.length(5);
    });

    it('recursively normalizes queries to relations', function() {
        const newWhere = this.normalize('Author', {
            lastName: {
                like: 'Orw%',
            },
            books: {
                publisher: {
                    name: 'NAL',
                },
            },
        });

        expect(newWhere)
            .to.have.property('and')
            .that.deep.equals([
                {
                    lastName: {
                        like: 'Orw%',
                    },
                },
                {
                    books: {
                        and: [
                            {
                                publisher: {
                                    and: [
                                        {
                                            name: {
                                                '=': 'NAL',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ]);
    });

    // not sure yet if this will work with the precedence for or operators
    it('recursively builds and queries from the existing request ' +
        'by flattening the and queries wrapped in objects', function() {
        const newWhere = this.normalize('Book', {
            title: 'Halo',
            authors: {
                firstName: 'Michael',
                and: [
                    {
                        lastName: {
                            like: 'Rü%',
                        },
                    },
                ],
            },
            and: [
                {
                    id: { gt: 100 },
                    title: { like: 'halo%' },
                },
                {
                    id: { lt: 200 },
                },
            ],
        });

        expect(newWhere)
            .to.have.property('and')
            .that.deep.equals([
                {
                    title: {
                        '=': 'Halo',
                    },
                },
                {
                    authors: {
                        and: [
                            {
                                firstName: {
                                    '=': 'Michael',
                                },
                            },
                            {
                                lastName: {
                                    like: 'Rü%',
                                },
                            },
                        ],
                    },
                },
                {
                    id: {
                        gt: 100,
                    },
                },
                {
                    title: {
                        like: 'halo%',
                    },
                },
                {
                    id: {
                        lt: 200,
                    },
                },
            ]);
    });

    // not sure yet if this will work with the precedence for or operators
    it('recursively builds and queries from the existing request ' +
        ' for all relations by flattening the and queries wrapped in objects', function() {
        const newWhere = this.normalize('Book', {
            authors: {
                firstName: {
                    like: 'Michael',
                },
                lastName: {
                    like: 'R%',
                },
            },
            pages: {
                and: [
                    {
                        number: {
                            gt: 2,
                        },
                    },
                    {
                        number: {
                            neq: null,
                        },
                    },
                ],
            },
        });

        expect(newWhere)
            .to.have.property('and')
            .that.deep.equals([
                {
                    authors: {
                        and: [
                            {
                                firstName: {
                                    like: 'Michael',
                                },
                            },
                            {
                                lastName: {
                                    like: 'R%',
                                },
                            },
                        ],
                    },
                },
                {
                    pages: {
                        and: [
                            {
                                number: {
                                    gt: 2,
                                },
                            },
                            {
                                number: {
                                    neq: null,
                                },
                            },
                        ],
                    },
                },
            ]);
    });

    it('respects or queries and normalizes them', function() {
        const newWhere = this.normalize('Book', {
            authors: {
                or: [
                    {
                        firstName: 'Michael',
                    },
                    {
                        firstName: 'Thomas',
                    },
                    {
                        and: [
                            {
                                lastName: {
                                    like: 'R%',
                                },
                            },
                            {
                                lastName: {
                                    like: '%t',
                                },
                            },
                        ],
                    },
                ],
            },
        });

        expect(newWhere)
            .to.have.property('and')
            .that.deep.equals([
                {
                    authors: {
                        or: [
                            {
                                firstName: { '=': 'Michael' },
                            },
                            {
                                firstName: { '=': 'Thomas' },
                            },
                            {
                                and: [
                                    {
                                        lastName: {
                                            like: 'R%',
                                        },
                                    },
                                    {
                                        lastName: {
                                            like: '%t',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
            ]);
    });

});
