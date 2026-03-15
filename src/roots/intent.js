import express from 'express';
import { verifyHmac } from '../middleware/verifyHmac.js';
import { commsAgent } from '../agents/commsAgent.js';
import { calendarAgent } from '../agents/calendarAgent.js';
import { githubAgent } from '../agents/githubAgent.js';

export const intentRouter = express.Router();

// Intent schema expected from the local model:
// {
//   "intents": [
//     { "agent": "comms",    "action": "read_emails",  "params": { "maxResults": 5 } },
//     { "agent": "calendar", "action": "list_events",  "params": {} },
//     { "agent": "github",   "action": "create_issue", "params": { "repo": "...", "title": "..." } }
//   ]
// }
//
// The X-LocalBridge-Signature header must be HMAC-SHA256(JSON.stringify(body), BRIDGE_HMAC_SECRET)

const AGENT_MAP = {
  comms: commsAgent,
  calendar: calendarAgent,
  github: githubAgent,
};

intentRouter.post('/', verifyHmac, async (req, res) => {
  const { intents } = req.body;

  if (!intents || !Array.isArray(intents) || intents.length === 0) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'Body must contain an intents array',
      example: { intents: [{ agent: 'comms', action: 'read_emails', params: {} }] },
    });
  }

  // Validate all agents are known before executing anything
  const unknown = intents.filter(i => !AGENT_MAP[i.agent]);
  if (unknown.length > 0) {
    return res.status(400).json({
      error: 'unknown_agents',
      message: `Unknown agent(s): ${unknown.map(i => i.agent).join(', ')}`,
      available: Object.keys(AGENT_MAP),
    });
  }

  // Dispatch all intents in parallel — each fetches its own scoped token
  const results = await Promise.allSettled(
    intents.map(intent => {
      const agentFn = AGENT_MAP[intent.agent];
      return agentFn(req, intent);
    })
  );

  // Shape the response — fulfilled = success, rejected = error (with reason)
  const response = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      agent: intents[i].agent,
      action: intents[i].action,
      error: result.reason?.message || 'Unknown error',
    };
  });

  // Strip any accidental token leakage from response (belt and suspenders)
  const safe = stripTokens(response);

  res.json({ results: safe, dispatched: intents.length });
});

// Recursively remove any key that looks like a token from the response object.
// The agents shouldn't include tokens in their return values, but this ensures
// nothing ever leaks back to the on-device model.
function stripTokens(obj) {
  if (Array.isArray(obj)) return obj.map(stripTokens);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => !/(token|secret|key|credential|password)/i.test(k))
        .map(([k, v]) => [k, stripTokens(v)])
    );
  }
  return obj;
}
