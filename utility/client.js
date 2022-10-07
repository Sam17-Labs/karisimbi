import { GraphQLClient } from "graphql-request";

export const graphqlClient = new GraphQLClient(process.env.HASURA_URL_HTTP, {
  headers: { "x-hasura-admin-secret": process.env.NEXT_PUBLIC_HASURA_SECRET},
});
