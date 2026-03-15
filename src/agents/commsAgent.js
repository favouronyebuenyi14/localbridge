import { getTokenForConnection } from '../middleware/tokenVault.js';

// Comms agent: handles email-related intents
// Scopes used: https://mail.google.com/
// The token is fetched fresh per request from Token Vault and
// never stored or logged. It is scoped to Gmail only.

export async function commsAgent(req, intent) {
  const token = await getTokenForConnection(req, 'google-oauth2');

  switch (intent.action) {
    case 'read_emails':
      return readEmails(token, intent.params?.maxResults || 5);
    case 'send_email':
      return sendEmail(token, intent.params);
    default:
      return { error: `Unknown comms action: ${intent.action}` };
  }
}

async function readEmails(token, maxResults) {
  // Fetch unread email IDs
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=is:unread`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Gmail list failed: ${err}`);
  }

  const { messages = [] } = await listRes.json();

  if (messages.length === 0) {
    return { agent: 'comms', result: 'No unread emails found.' };
  }

  // Fetch snippet + subject for each message
  const emails = await Promise.all(
    messages.map(async ({ id }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msg = await msgRes.json();
      const subject = msg.payload?.headers?.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = msg.payload?.headers?.find(h => h.name === 'From')?.value || 'unknown';
      return { id, subject, from, snippet: msg.snippet };
    })
  );

  return { agent: 'comms', action: 'read_emails', result: emails };
}

async function sendEmail(token, params) {
  const { to, subject, body } = params || {};

  if (!to || !subject || !body) {
    return { error: 'send_email requires to, subject, and body params' };
  }

  // RFC 2822 format required by Gmail API
  const raw = btoa(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain\r\n\r\n${body}`
  ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const sendRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`Gmail send failed: ${err}`);
  }

  return { agent: 'comms', action: 'send_email', result: 'Email sent successfully' };
}
