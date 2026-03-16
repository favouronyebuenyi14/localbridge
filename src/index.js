import 'dotenv/config';
import express from 'express';
import { auth } from 'express-openid-connect';
import { intentRouter } from './routes/intent.js';
import { requireAuth } from './middleware/requireAuth.js';

const app = express();
app.use(express.json());

// ─── Auth0 session middleware ──────────────────────────────────────────────
// express-openid-connect handles the full OAuth callback, session cookie,
// and refresh token storage. getAccessTokenForConnection() reads from this
// session to perform the Token Vault exchange.
app.use(
  auth({
    authRequired: false,         // Only force login on protected routes
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: 'https://localbridge.onrender.com',
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
 authorizationParams: {
  response_type: 'code',
  scope: 'openid profile email offline_access read:me:connected_accounts',
  audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
},
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────

// Health check — useful for Railway deploy verification
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth callback is handled automatically by express-openid-connect at /callback
// Trigger Google connected account flow
// Visit this in browser to link your Google account to Token Vault
app.get('/connect/google', requireAuth, (req, res) => {
  const returnTo = encodeURIComponent('https://localbridge.onrender.com/connect/google/done');
  res.redirect(
    `https://${process.env.AUTH0_DOMAIN}/authorize?` +
    `client_id=${process.env.AUTH0_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent('https://localbridge.onrender.com/callback')}` +
    `&scope=openid%20profile%20email%20offline_access` +
    `&connection=google-oauth2` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${returnTo}`
  );
});

app.get('/connect/google/done', requireAuth, (req, res) => {
  res.json({ message: 'Google account connected to Token Vault', user: req.oidc.user });
});

// Trigger GitHub connected account flow
app.get('/connect/github', requireAuth, (req, res) => {
  res.redirect(
    `https://${process.env.AUTH0_DOMAIN}/authorize?` +
    `client_id=${process.env.AUTH0_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent('https://localbridge.onrender.com/callback')}` +
    `&scope=openid%20profile%20email%20offline_access` +
    `&connection=github` +
    `&prompt=consent`
  );
});

// Profile — see current session and connected accounts
app.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.oidc.user });
});

app.get('/debug', requireAuth, (req, res) => {
  res.json({
    isAuthenticated: req.oidc.isAuthenticated(),
    hasAccessToken: !!req.oidc?.accessToken,
    accessTokenType: typeof req.oidc?.accessToken,
    accessTokenKeys: req.oidc?.accessToken ? Object.keys(req.oidc.accessToken) : [],
    hasRefreshToken: !!req.oidc?.refreshToken,
    user: req.oidc?.user,
    idTokenClaims: req.oidc?.idTokenClaims,
  });
});

// Browser test endpoint — tests Token Vault without needing HMAC from terminal
app.get('/test/emails', requireAuth, async (req, res) => {
  try {
    console.log('Access token:', JSON.stringify(req.oidc?.accessToken));
    console.log('Refresh token:', req.oidc?.refreshToken ? 'exists' : 'missing');
    const { commsAgent } = await import('./agents/commsAgent.js');
    const result = await commsAgent(req, { action: 'read_emails', params: { maxResults: 5 } });
    res.json(result);
  } catch (err) {
    console.error('FULL ERROR:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Main intent endpoint — receives signed intents from the local model
app.use('/intent', requireAuth, intentRouter);

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LocalBridge running on http://localhost:${PORT}`);
  console.log(`Connect Google: http://localhost:${PORT}/connect/google`);
  console.log(`Connect GitHub: http://localhost:${PORT}/connect/github`);
});