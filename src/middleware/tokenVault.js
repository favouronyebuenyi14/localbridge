import { ApiClient } from '@auth0/auth0-api-js';

const apiClient = new ApiClient({
  domain: process.env.AUTH0_DOMAIN,
  audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

export async function getTokenForConnection(req, connection) {
  const accessToken = req.oidc?.accessToken?.access_token;

  if (!accessToken) {
    throw new Error('No access token in session. Visit /connect/google to log in again.');
  }

 try {
    const tokenSet = await apiClient.getAccessTokenForConnection({
      connection: connection,
      accessToken: accessToken,
    });
    return tokenSet.access_token;
  } catch (err) {
    console.error('Token Vault full error:', JSON.stringify(err, null, 2));
    console.error('Token Vault message:', err.message);
    console.error('Access token used:', accessToken?.substring(0, 20) + '...');
    throw err;
  }