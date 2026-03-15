import crypto from 'crypto';

// Verifies that the POST /intent request was signed by the local model
// using the shared BRIDGE_HMAC_SECRET. This is the trust boundary between
// the on-device model and the cloud bridge — no valid signature = rejected.
//
// The local model must:
//   1. JSON.stringify the intent body
//   2. HMAC-SHA256 sign it with BRIDGE_HMAC_SECRET
//   3. Send the hex digest in the X-LocalBridge-Signature header

export function verifyHmac(req, res, next) {
  const signature = req.headers['x-localbridge-signature'];

  if (!signature) {
    return res.status(401).json({
      error: 'missing_signature',
      message: 'X-LocalBridge-Signature header is required',
    });
  }

  const secret = process.env.BRIDGE_HMAC_SECRET;
  if (!secret) {
    console.error('BRIDGE_HMAC_SECRET is not set in .env');
    return res.status(500).json({ error: 'bridge_misconfigured' });
  }

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Constant-time comparison prevents timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expBuffer = Buffer.from(expected, 'hex');

  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    return res.status(401).json({
      error: 'invalid_signature',
      message: 'HMAC signature does not match — request rejected',
    });
  }

  next();
}
