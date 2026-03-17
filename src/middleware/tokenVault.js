import { ManagementClient } from 'auth0';

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

export async function getTokenForConnection(req, connection) {
  const userId = req.oidc?.user?.sub;

  console.log('userId:', userId);
  console.log('userId type:', typeof userId);

  if (!userId) {
    throw new Error('No user in session.');
  }

  try {
    const user = await management.users.get(userId);
    console.log('User:', JSON.stringify(user));
    const identity = user?.identities?.find(i => i.connection === connection);

    if (!identity?.access_token) {
      throw new Error(`No access token found for ${connection}.`);
    }

    return identity.access_token;
  } catch (err) {
    console.error('Full error:', JSON.stringify(err));
    throw new Error(`Failed to get token for ${connection}: ${err.message}`);
  }
}