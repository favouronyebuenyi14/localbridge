import { ApiClient } from '@auth0/auth0-api-js';

const apiClient = new ApiClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

export async function getTokenForConnection(req, connection) {
  const accessToken = req.oidc.accessToken?.access_token;

  if (!accessToken) {
    throw new Error('No access token in session. User may need to log in again.');
  }

  const tokenSet = await apiClient.getAccessTokenForConnection({
    connection: connection,
    accessToken: accessToken,
  });

  return tokenSet.access_token;
}