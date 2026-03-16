// Performs the Auth0 Token Vault exchange for a given connection.
// This is the core of LocalBridge's security model:
//   - The local model sends an intent (no credentials)
//   - This function exchanges the user's Auth0 session for a
//     short-lived, scoped provider token
//   - That token is used for one API call, then discarded
//   - The local model never sees it
//
// Based on the official pattern from auth0.com/ai/docs/intro/token-vault

export async function getTokenForConnection(req, connection) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  // Get the user's current refresh token from their Auth0 session
  const tokenSet = req.oidc.accessToken;
  const refreshToken = req.oidc.refreshToken;

  if (!refreshToken) {
    throw new Error(
      'No refresh token in session. Make sure offline_access scope was requested ' +
      'and Refresh Token Rotation is DISABLED in your Auth0 app settings.'
    );
  }

  // Token Vault exchange — RFC 8693 "on behalf of" pattern
  // Exchange the user's Auth0 refresh token for a provider-specific access token
  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
  client_id: clientId,
  client_secret: clientSecret,
  subject_token: refreshToken,
  subject_token_type: 'urn:ietf:params:oauth:token-type:refresh_token',
  requested_token_type: 'urn:auth0:params:oauth:token-type:connection_access_token',
  connection: connection,
}),

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Token Vault exchange failed for ${connection}: ${error.error} — ${error.error_description}`
    );
  }

  const { access_token } = await response.json();
  return access_token;
}
