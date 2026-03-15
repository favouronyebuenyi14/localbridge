import { getTokenForConnection } from '../middleware/tokenVault.js';

// Calendar agent: handles scheduling intents
// Scopes used: https://www.googleapis.com/auth/calendar
// Same Google connection as comms — Auth0 Token Vault issues a token
// covering both scopes since both were requested during the connect flow.

export async function calendarAgent(req, intent) {
  const token = await getTokenForConnection(req, 'google-oauth2');

  switch (intent.action) {
    case 'list_events':
      return listEvents(token, intent.params);
    case 'create_event':
      return createEvent(token, intent.params);
    default:
      return { error: `Unknown calendar action: ${intent.action}` };
  }
}

async function listEvents(token, params = {}) {
  const now = new Date().toISOString();
  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', params.timeMin || now);
  url.searchParams.set('timeMax', params.timeMax || weekAhead);
  url.searchParams.set('maxResults', params.maxResults || 10);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Calendar list failed: ${await res.text()}`);

  const { items = [] } = await res.json();
  const events = items.map(e => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
  }));

  return { agent: 'calendar', action: 'list_events', result: events };
}

async function createEvent(token, params = {}) {
  const { summary, start, end, description } = params;

  if (!summary || !start || !end) {
    return { error: 'create_event requires summary, start, and end params' };
  }

  const event = {
    summary,
    description: description || '',
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) throw new Error(`Calendar create failed: ${await res.text()}`);

  const created = await res.json();
  return {
    agent: 'calendar',
    action: 'create_event',
    result: { id: created.id, summary: created.summary, link: created.htmlLink },
  };
}
