export async function getTokenForConnection(req, connection) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  const accessToken = req.oidc?.accessToken?.access_token;

  if (!accessToken) {
    throw new Error('No access token in session. User needs to log in again.');
  }

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: clientId,
      client_secret: clientSecret,
      subject_token: accessToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
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

  const data = await response.json();
  return data.access_token;
}