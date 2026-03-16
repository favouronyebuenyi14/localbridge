export async function getTokenForConnection(req, connection) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const refreshToken = req.oidc?.refreshToken;
  const accessToken = req.oidc?.accessToken?.access_token;

  console.log('refreshToken exists:', !!refreshToken);
  console.log('accessToken exists:', !!accessToken);

  if (!refreshToken) {
    throw new Error('No refresh token. User needs to log in again.');
  }

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token',
    subject_token: refreshToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:refresh_token',
    requested_token_type: 'http://auth0.com/oauth/token-type/federated-connection-access-token',
    connection: connection,
  };

  console.log('Token exchange body:', JSON.stringify({ ...body, client_secret: '***', subject_token: '***' }));

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log('Token exchange response:', JSON.stringify(data));

  if (!response.ok) {
    throw new Error(`Token Vault error: ${data.error} — ${data.error_description}`);
  }

  return data.access_token;
}