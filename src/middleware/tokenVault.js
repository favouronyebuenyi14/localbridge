import { ApiClient } from '@auth0/auth0-api-js';

export async function getTokenForConnection(req, connection) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  const accessToken = req.oidc?.accessToken?.access_token;

  if (!accessToken) {
    throw new Error('No access token in session. User needs to log in again.');
  }

  const apiClient = new ApiClient({
    domain: domain,
    audience: `https://${domain}/api/v2/`,
    clientId: clientId,
    clientSecret: clientSecret,
  });

  const result = await apiClient.getAccessTokenForConnection({
    connection: connection,
    accessToken: accessToken,
  });

  return result.access_token;
}