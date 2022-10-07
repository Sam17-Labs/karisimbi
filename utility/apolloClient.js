import { split, ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_HASURA_URL_HTTP,
});

const wsLink =
  typeof window !== "undefined"
    ? new GraphQLWsLink(
        createClient({
          url: process.env.NEXT_PUBLIC_HASURA_URL_WS,
          on: {
            connected: () => console.log("connected client"),
            closed: () => console.log("closed"),
          },
          connectionParams: {
            headers: {
              "x-hasura-admin-secret": process.env.NEXT_PUBLIC_HASURA_SECRET,
            },
          },
        })
      )
    : null;

const authLink = setContext((_, { headers }) => {
  const authToken = process.env.NEXT_PUBLIC_HASURA_SECRET;

  return {
    headers: {
      ...headers,
      "x-hasura-admin-secret": `${authToken}`,
      "content-type": "application/json",
    },
  };
});

const splitLink =
  wsLink != null
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
          );
        },
        wsLink,
        httpLink
      )
    : httpLink;

const client = new ApolloClient({
  link: authLink.concat(splitLink),
  cache: new InMemoryCache(),
});

export default client;
