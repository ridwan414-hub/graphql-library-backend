const { GraphQLError } = require('graphql')
const { PubSub } = require('graphql-subscriptions')

const pubsub = new PubSub()
const jwt = require('jsonwebtoken')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

const resolvers = {
    Query: {
        bookCount: async () => Book.collection.countDocuments(),
        authorCount: async () => Author.collection.countDocuments(),
        allAuthors: async (root, args) => {
            if (args.name) {
                return await Author.find({ name: args.name }).populate('books')
            }
            return await Author.find({}).populate('books')
        },
        me: async (root, args, { currentUser }) => currentUser,
        allBooks: async (root, args) => {
            const foundAuthor = await Author.findOne({ name: args.author })

            if (args.author && args.genres) {
                return await Book.find({ author: foundAuthor.id, genres: { $in: args.genres } }).populate('author')
            }
            else if (args.author) {
                return await Book.find({ author: foundAuthor.id }).populate('author')
            }
            else if (args.genres) {
                return await Book.find({ genres: { $in: args.genres } }).populate('author')
            } else {
                return await Book.find({}).populate('author')
            }
        },
    },
    Author: {
        bookCount: async (root) => {
            const foundBooks = await Book.find({ author: root.id })
            return foundBooks.length
            // return root.books.length
        },
        books: async (root) => {
            return await Book.find({ author: root.id })
        }
    },
    Mutation: {
        addBook: async (root, args, { currentUser }) => {
            console.log('addBook called with args:', args);
            console.log('currentUser:', currentUser);

            const existAuthor = await Author.findOne({ name: args.author });
            console.log('existAuthor:', existAuthor);

            if (!currentUser) {
                throw new GraphQLError('not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                    }
                });
            }

            if (!existAuthor) {
                const newAuthor = new Author({ name: args.author });
                console.log('Creating new author:', newAuthor);

                try {
                    const book = new Book({ ...args, author: newAuthor._id });
                    newAuthor.books = newAuthor.books.concat(book._id);
                    await newAuthor.save();
                    await book.save();
                    const newBook = await Book.findById(book._id).populate('author');
                    pubsub.publish("BOOK_ADDED", { bookAdded: newBook });
                    console.log('New book created:', newBook);
                    return newBook;
                } catch (error) {
                    console.error('Error saving new author and book:', error);
                    throw new GraphQLError('saving author failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args,
                            error
                        }
                    });
                }
            } else {
                const book = new Book({ ...args, author: existAuthor._id });
                existAuthor.books = existAuthor.books.concat(book._id);
                console.log('Adding book to existing author:', existAuthor);

                try {
                    // Validate existAuthor before saving
                    if (!existAuthor._id || !existAuthor.name) {
                        throw new Error('existAuthor is missing required fields');
                    }
                    await book.save();
                    await existAuthor.save();
                    const newBook = await Book.findById(book._id).populate('author');
                    pubsub.publish('BOOK_ADDED', { bookAdded: newBook });
                    console.log('Book added to existing author:', newBook);
                    return newBook;
                } catch (error) {
                    console.error('Error saving book to existing author:', error);
                    throw new GraphQLError('saving book failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args,
                            error
                        }
                    });
                }
            }
        },
        editAuthor: async (root, args, { currentUser }) => {
            const author = await Author.findOne({ name: args.name })
            if (!currentUser) {
                throw new GraphQLError('not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                    }
                })
            }
            if (!author) {
                return null
            } else {
                author.born = args.born
                try {
                    await author.save()
                } catch (error) {
                    throw new GraphQLError('saving born year failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args.name,
                            error
                        }
                    })
                }
                pubsub.publish('AUTHOR_EDITED', { authorEdited: author })
                return author
            }
        },
        createUser: async (root, args) => {
            const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
            try {
                await user.save()
            } catch (error) {
                throw new GraphQLError('Creating user failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: arg.username,
                        error
                    }
                })
            }
            return user
        },
        login: async (root, args) => {
            const user = await User.findOne({ username: args.username })

            if (!user || args.password != 'password123') {
                throw new GraphQLError('wrong credentials', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }
            const userForToken = {
                username: user.username,
                id: user._id
            }

            return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
        },
    },
    Subscription: {
        bookAdded: {
            subscribe: () => pubsub.asyncIterator(['BOOK_ADDED'])
        },
        authorEdited: {
            subscribe: () => pubsub.asyncIterator(['AUTHOR_EDITED'])
        }
    }
}


module.exports = resolvers  