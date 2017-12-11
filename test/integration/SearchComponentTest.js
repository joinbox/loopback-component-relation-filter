const { expect } = require('chai');

const createAndLinkBookData = require('../support/fixtures/createAndLinkBookData');

describe('The loopback-search-component', () => {

    before(function() {
        this.Book = this.models.Book;
        this.Publisher = this.models.Publisher;
        this.Page = this.models.Page;
        this.Author = this.models.Author;
    });

    before('create and link book data', async function() {
        return createAndLinkBookData(this.models);
    });

    it('the component allows filtering over related models', async function() {

        const query = {
            where: {
                authors: {
                    firstName: 'George',
                    lastName: {
                        ilike: 'orwe%',
                    },
                },
            },
            include: ['authors'],
        };
        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(2);

        const book1 = books.find(book => book.title === 'Animal Farm');
        const book2 = books.find(book => book.title === '1984');

        expect(book1).to.be.ok;
        expect(book2).to.be.ok;
    });

    it('the component creates a corresponding error for unknown properties ' +
        '(if configured accordingly)', async function() {

        const query = {
            where: {
                test: 'unknown',
            },
        };
        // this will usually return 5 books
        try {
            const response = await (this.apiClient.get('/authors')
                .set('accept', 'application/json')
                .query({ filter: JSON.stringify(query) })
                .then(result => result.body));
        } catch (err) {
            expect(err).to.have.property('status', 409);
            return;
        }
        throw new Error('Querying property "test" on "/authors" did not fail as expected.');
    });
});
