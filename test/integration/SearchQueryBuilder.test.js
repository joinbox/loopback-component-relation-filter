const { expect } = require('chai');

const SearchQueryBuilder = require('../../src/SearchQueryBuilder');

describe('The SearchQueryBuilder', function() {

    beforeEach('setup query builder', function() {
        // set the preserveColumnCase option to false, since the postgres connector seems to
        // do weird conversions now and then
        // @see: https://github.com/strongloop/loopback-connector-postgresql/issues/38
        this.builder = new SearchQueryBuilder(this.models, { preserveColumnCase: false });
    });

    const cases = [
        {
            message: 'creates a base query if there are no where clauses',
            where: {},
            result: 'select "book"."id" from "public"."book" as "book" group by "book"."id"',
        },
        {
            message: 'joins belongsTo relations and applies where clauses',
            where: {
                publisher: {
                    id: 1,
                },
            },
            result: `select "book"."id" from "public"."book" as "book"
                        inner join "public"."publisher" as "book_publisher" on "book"."publisherid" = "book_publisher"."id"
                        where (("book_publisher"."id" = 1))
                     group by "book"."id"`,
        },
        {
            message: 'correctly aliases different relations to the same model',
            where: {
                authors: {
                    firstName: 'Michael',
                },
                coAuthors: {
                    firstName: 'Michael',
                },
                mainAuthor: {
                    firstName: 'Michael',
                },
            },
            result: `select "book"."id" from "public"."book" as "book"
                        inner join "public"."authorbook" as "book_authorbook_authors" on "book"."id" = "book_authorbook_authors"."bookid"
                        inner join "public"."author" as "book_authors" on "book_authorbook_authors"."authorid" = "book_authors"."id"
                        inner join "public"."authorbook" as "book_authorbook_coauthors" on "book"."id" = "book_authorbook_coauthors"."bookid"
                        inner join "public"."author" as "book_coauthors" on "book_authorbook_coauthors"."authorid" = "book_coauthors"."id"
                        inner join "public"."author" as "book_mainauthor" on "book"."mainauthorid" = "book_mainauthor"."id"
                    where (("book_authors"."firstname" = 'Michael')
                    and ("book_coauthors"."firstname" = 'Michael')
                    and ("book_mainauthor"."firstname" = 'Michael'))
                    group by "book"."id"`,
        },
        {
            message: 'appends join clauses for the queried relations and filters unknown properties',
            where: {
                publisher: {
                    id: 1,
                },
                title: 'wow',
                authors: {
                    firstName: 'Michael',
                    address: {
                        zip: 4500,
                    },
                },
            },
            result: `select "book"."id" from "public"."book" as "book"
                        inner join "public"."publisher" as "book_publisher" on "book"."publisherid" = "book_publisher"."id"
                        inner join "public"."authorbook" as "book_authorbook_authors" on "book"."id" = "book_authorbook_authors"."bookid"
                        inner join "public"."author" as "book_authors" on "book_authorbook_authors"."authorid" = "book_authors"."id"
                    where (("book_publisher"."id" = 1)
                    and "book"."title" = 'wow'
                    and ("book_authors"."firstname" = 'Michael'))
                    group by "book"."id"`,

        },
        {
            message: 'appends join clauses for all the queried relations',
            where: {
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
            result: `select "book"."id" from "public"."book" as "book"
                        inner join "public"."authorbook" as "book_authorbook_authors" on "book"."id" = "book_authorbook_authors"."bookid"
                        inner join "public"."author" as "book_authors" on "book_authorbook_authors"."authorid" = "book_authors"."id"
                        inner join "public"."page" as "book_pages" on "book"."id" = "book_pages"."bookid"
                    where (("book_authors"."firstname" like 'Michael'
                            and "book_authors"."lastname" like 'R%')
                        and ("book_pages"."number" > 2
                            and "book_pages"."number" != NULL))
                    group by "book"."id"`,
        },
        {
            message: 'aliases join clauses with through models',
            where: {
                authors: {
                    and: [
                        {
                            firstName: {
                                like: 'Michael',
                            },
                        },
                    ],
                },
            },
            result: `select "book"."id" from "public"."book" as "book"
                        inner join "public"."authorbook" as "book_authorbook_authors" on "book"."id" = "book_authorbook_authors"."bookid"
                        inner join "public"."author" as "book_authors" on "book_authorbook_authors"."authorid" = "book_authors"."id"
                    where (("book_authors"."firstname" like 'Michael'))
                    group by "book"."id"`,
        },
        {
            message: 'properly respects simple or clauses',
            where: {
                or: [
                    {
                        title: 'Animal Farm',
                    },
                    {
                        title: '1984',
                    },
                ],
            },
            result: `select "book"."id" from "public"."book" as "book" 
                        where ("book"."title" = 'Animal Farm' or "book"."title" = '1984') 
                    group by "book"."id"`,
        },
        {
            message: 'properly respects or clauses',
            where: {
                or: [
                    {
                        title: 'Animal Farm',
                    },
                    {
                        authors: {
                            firstName: 'Scott',
                        },
                    },
                ],
            },
            result: `select "book"."id" from "public"."book" as "book"
                        inner join "public"."authorbook" as "book_authorbook_authors" on "book"."id" = "book_authorbook_authors"."bookid"
                        inner join "public"."author" as "book_authors" on "book_authorbook_authors"."authorid" = "book_authors"."id"
                    where ("book"."title" = 'Animal Farm' 
                        or ("book_authors"."firstname" = 'Scott')) 
                    group by "book"."id"`,
        },
        {
            message: 'joins multiple relations 1',
            model: 'Author',
            where: {
                and: [
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
                ],
            },
            result: `select "author"."id" from "public"."author" as "author" 
                inner join "public"."authorbook" as "author_authorbook_books" 
                    on "author"."id" = "author_authorbook_books"."authorid" 
                inner join "public"."book" as "author_books" 
                    on "author_authorbook_books"."bookid" = "author_books"."id" 
                inner join "public"."publisher" as "book_publisher" 
                    on "author_books"."publisherid" = "book_publisher"."id" 
            where ("author"."lastname" like 'Orw%' and (("book_publisher"."name" = 'NAL'))) group by "author"."id"`,
        },
    ];

    runCases(cases, this);

    describe('supports comparison operators on the root level', function() {
        function createResult(comparator, value = 1, column = '"book"."id"') {
            return `select "book"."id" from "public"."book" as "book"
                        where (${column} ${comparator} ${value}) group by "book"."id"`;
        }
        const cases = [
            {
                message: 'default equality',
                where: { id: 1 },
                result: createResult('='),
            },
            {
                message: '=',
                where: { id: { '=': 1 } },
                result: createResult('='),
            },
            {
                message: 'neq',
                where: { id: { neq: 1 } },
                result: createResult('!='),
            },
            {
                message: 'lt',
                where: { id: { lt: 1 } },
                result: createResult('<'),
            },
            {
                message: 'lte',
                where: { id: { lte: 1 } },
                result: createResult('<='),
            },
            {
                message: 'gt',
                where: { id: { gt: 1 } },
                result: createResult('>'),
            },
            {
                message: 'gte',
                where: { id: { gte: 1 } },
                result: createResult('>='),
            },
            {
                message: 'like',
                where: { id: { like: '%2' } },
                result: createResult('like', "'%2'"),
            },
            {
                message: 'ilike',
                where: { id: { ilike: '%2' } },
                result: createResult('ilike', "'%2'"),
            },
            {
                message: 'nlike',
                where: { id: { nlike: '%2' } },
                result: createResult('not like', "'%2'"),
            },
            {
                message: 'nilike',
                where: { id: { nilike: '%2' } },
                result: createResult('not ilike', "'%2'"),
            },
            {
                message: 'between',
                where: { id: { between: [1, 100] } },
                result: createResult('between', '1 and 100'),
            },
            {
                message: 'inq',
                where: { id: { inq: [1, 10, 100] } },
                result: createResult('in', '(1, 10, 100)'),
            },
            {
                message: 'nin',
                where: { id: { nin: [1, 10, 100] } },
                result: createResult('not in', '(1, 10, 100)'),
            },
        ];

        runCases(cases, this);

        it('throws an error if the rejectUnknownProperties is passed to the builder' +
            'and invalid properties were found in the query', function() {
            const builder = new SearchQueryBuilder(this.models, { rejectUnknownProperties: true });
            expect(() => {
                builder.buildQuery('Book', {
                    where: {
                        test: 'fake',
                    },
                });
            }).to.throw;
        });

        it.skip('regexp: (not supported yet)', function() {
            runCase.call(this, {
                where: { id: { regexp: [0, 5, 10] } },
                message: 'regexp',
                result: '',
            });
        });

        it.skip('near: (not supported yet)', function() {
            runCase.call(this, {
                where: { id: { near: [0, 5, 10] } },
                message: 'near',
                result: '',
            });
        });

    });

    describe('supports comparison operators on nested levels', function() {

        runCases([
            {
                message: 'greater than and equality',
                where: {
                    pages: {
                        number: {
                            gt: 1,
                        },
                    },
                    id: 1,
                },
                result: `select "book"."id" from "public"."book" as "book"
                            inner join "public"."page" as "book_pages" on "book"."id" = "book_pages"."bookid"
                         where (("book_pages"."number" > 1)
                         and "book"."id" = 1)
                         group by "book"."id"`,
            },
            {
                message: 'less than and greater than in or blocks',
                where: {
                    pages: {
                        or: [
                            {
                                number: {
                                    lt: 5,
                                },
                            },
                            {
                                number: {
                                    gt: 10,
                                },
                            },
                        ],
                    },
                    id: 1,
                },
                result: `select "book"."id" from "public"."book" as "book"
                                inner join "public"."page" as "book_pages" on "book"."id" = "book_pages"."bookid"
                            where (("book_pages"."number" < 5 or "book_pages"."number" > 10) and "book"."id" = 1)
                            group by "book"."id"`,
            },
        ], this);

    });

    function normalizeExpectedResult(queryString) {
        return queryString.replace(/\s{2,}/g, ' ');
    }

    function runCases(cases, context) {
        cases.forEach((testCase) => {
            runCase.call(context, testCase);
        });
    }

    function runCase(testCase) {
        const model = testCase.model || 'Book';
        const message = testCase.message;

        it(message, function() {
            const filter = { where: testCase.where };
            const expectedResult = testCase.result;

            const query = this.builder.buildQuery(model, filter);
            const queryString = query.toString();
            const normalizedResult = normalizeExpectedResult(expectedResult);

            expect(queryString).to.be.equal(normalizedResult);
        });
    }

});
