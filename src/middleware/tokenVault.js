export async function getTokenForConnection(req, connection) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  const tokenSet = req.oidc.accessToken;
  const refreshToken = req.oidc.refreshToken;

  if (!refreshToken) {
    throw new Error(
      'No refresh token in session. Make sure offline_access scope was requested ' +
      'and Refresh Token Rotation is DISABLED in your Auth0 app settings.'
    );
  }

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
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Token Vault exchange failed for ${connection}: ${error.error} — ${error.error_description}`
    );
  }

  const { access_token } = await response.json();
  return access_token;
}