import 'dotenv/config';
import express from 'express';
import { auth } from 'express-openid-connect';
import { intentRouter } from './routes/intent.js';
import { requireAuth } from './middleware/requireAuth.js';

const app = express();
app.use(express.json());

const BASE_URL = 'https://localbridge.onrender.com';

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
    authorizationParams: {
      response_type: 'code',
      scope: 'openid profile email offline_access',
      connection: 'google-oauth2',
      access_type: 'offline',
      prompt: 'consent',
    },
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.oidc.user });
});

app.get('/debug', requireAuth, (req, res) => {
  res.json({
    isAuthenticated: req.oidc.isAuthenticated(),
    hasAccessToken: !!req.oidc?.accessToken,
    accessTokenKeys: req.oidc?.accessToken ? Object.keys(req.oidc.accessToken) : [],
    hasRefreshToken: !!req.oidc?.refreshToken,
    sub: req.oidc?.user?.sub,
    email: req.oidc?.user?.email,
  });
});

app.get('/test/emails', requireAuth, async (req, res) => {
  try {
    const { commsAgent } = await import('./agents/commsAgent.js');
    const result = await commsAgent(req, { action: 'read_emails', params: { maxResults: 5 } });
    res.json(result);
  } catch (err) {
    console.error('FULL ERROR:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.use('/intent', requireAuth, intentRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LocalBridge running on ${BASE_URL}`);
});