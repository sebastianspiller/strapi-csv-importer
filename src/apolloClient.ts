import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import authenticateUser from "./authenticateUser";
import fetch from "cross-fetch";

/**
 * Creates an Apollo Client with the given email and password.
 * If no email and password are provided, the client will be created without authentication.
 * @param {string | undefined} email - The email of the user.
 * @param {string | undefined} password - The password of the user.
 * @returns {ApolloClient<InMemoryCache>} The Apollo Client.
 */
export default async function createApolloClient(email = "", password = "") {
  let jwtToken;
  let headers = {};
  if (email && password) {
    jwtToken = await authenticateUser(email, password);
    headers = {
      Authorization: `Bearer ${jwtToken}`,
    };
  }

  return new ApolloClient({
    ssrMode: true,
    link: new HttpLink({
      uri: `${process.env.STRAPI_URL}/graphql`,
      headers: headers,
      fetch,
    }),
    cache: new InMemoryCache(),
  });
}
