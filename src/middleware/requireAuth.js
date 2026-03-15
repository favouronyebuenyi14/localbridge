// Middleware: blocks unauthenticated requests
// For browser routes (like /connect/google), redirects to Auth0 login.
// For API routes (like POST /intent), returns 401 JSON instead of redirecting.
export function requireAuth(req, res, next) {
  if (req.oidc.isAuthenticated()) return next();

  const isApiCall = req.headers['content-type']?.includes('application/json')
    || req.path.startsWith('/intent');

  if (isApiCall) {
    return res.status(401).json({
      error: 'unauthenticated',
      message: 'Visit /connect/google in a browser first to link your account',
    });
  }

  // Browser request — kick off login
  res.oidc.login({ returnTo: req.originalUrl });
}
