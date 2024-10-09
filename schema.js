const typeDefs = `
  type Token {
    value: String!
  }

  type User {
    username: String!
    favoriteGenre: String
    id: ID!
  }
       

  type Author{
    name: String!
    id: ID!
    born: Int
    books: [Book!]!
    bookCount: Int!
  }

  type Book{
      title: String!
      published: Int!
      author: Author!
      id: ID!
      genres: [String!]!
  }

  type Query {
    bookCount: Int!,
    authorCount: Int!,
    allBooks(author: String,genres: String): [Book!]!,
    allAuthors(name:String): [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book,
    
    editAuthor(
        name: String!
        born: Int!
    ): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token
    
  }
  
  type Subscription {
    bookAdded: Book!
    authorEdited: Author!
  }
`

module.exports = typeDefs