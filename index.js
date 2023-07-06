const express = require("express");
const { createServer } = require("http");
const { execute, subscribe } = require("graphql");
const { PubSub } = require("graphql-subscriptions");
const { ApolloServer, gql } = require("apollo-server-express");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { SubscriptionServer } = require("subscriptions-transport-ws");

const app = express();
const httpServer = createServer(app);
const pubsub = new PubSub();

const typeDefs = gql`
  type Message {
    id: ID!
    content: String!
  }

  type Query {
    messages: [Message!]!
  }

  type Mutation {
    postMessage(content: String!): ID!
  }

  type Subscription {
    newMessage: Message!
  }
`;

const NEW_MESSAGE = "NEW_MESSAGE";
const messages = [];

const resolvers = {
  Query: {
    messages: () => messages,
  },
  Mutation: {
    postMessage: (_, { content }) => {
      const id = messages.length.toString();
      const message = { id, content };
      messages.push(message);

      pubsub.publish(NEW_MESSAGE, { newMessage: message });

      return id;
    },
  },
  Subscription: {
    newMessage: {
      subscribe: () => pubsub.asyncIterator(NEW_MESSAGE),
    },
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
});

async function startApolloServer() {
  await server.start();

  server.applyMiddleware({ app });

  new SubscriptionServer(
    {
      execute,
      subscribe,
      schema,
    },
    {
      server: httpServer,
      path: server.graphqlPath,
    }
  );

  const port = 3007;
  httpServer.listen(port, () => {
    console.log(
      `🚀 Server ready at http://localhost:${port}${server.graphqlPath}`
    );
    console.log(
      `🚀 Subscriptions ready at ws://localhost:${port}${server.graphqlPath}`
    );
  });
}

startApolloServer().catch((err) => {
  console.error("Error starting Apollo Server:", err);
});
