#!/usr/bin/env node
/**
 * send.js — LocalBridge client (Node.js + Groq)
 *
 * Replaces local_sender.py. No Python needed.
 *
 * Usage:
 *   node send.js "Summarise my last 5 unread emails"
 *   node send.js "What's on my calendar this week?"
 *   node send.js "List my GitHub repos"
 *   node send.js "Plan a trip to London, email the itinerary to my team"
 *
 * Setup:
 *   Add to your .env:
 *     GROQ_API_KEY=your-groq-api-key
 *     BRIDGE_URL=http://localhost:3000        (or your Railway URL)
 *     BRIDGE_HMAC_SECRET=same-as-bridge
 */

import 'dotenv/config';
import crypto from 'crypto';
import Groq from 'groq-sdk';

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3000';
const HMAC_SECRET = process.env.BRIDGE_HMAC_SECRET;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ─── Validate env ──────────────────────────────────────────────────────────
if (!GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY not set in .env');
  process.exit(1);
}
if (!HMAC_SECRET) {
  console.error('Error: BRIDGE_HMAC_SECRET not set in .env');
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

const SYSTEM_PROMPT = `
You are an intent extraction engine for LocalBridge.
Given a user request, output ONLY valid JSON — no explanation, no markdown.

The JSON must follow this schema exactly:
{
  "intents": [
    {
      "agent": "<comms|calendar|github>",
      "action": "<action_name>",
      "params": {}
    }
  ]
}

Available agents and actions:
- comms:    read_emails (params: maxResults), send_email (params: to, subject, body)
- calendar: list_events (params: timeMin, timeMax), create_event (params: summary, start, end)
- github:   list_repos, create_issue (params: repo, title, body)

A single request can produce multiple intents if needed.
Output raw JSON only. Never include markdown, backticks, or prose.
`.trim();

// ─── Step 1: Extract intent from Groq ─────────────────────────────────────
async function extractIntent(userPrompt) {
  console.log('\n🤖 Sending to Groq (Llama 3)...');

  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_object' }, // guarantees valid JSON back
    temperature: 0.1,                          // low temp = consistent JSON
  });

  const raw = response.choices[0].message.content;

  try {
    return JSON.parse(raw);
  } catch {
    console.error('Groq returned invalid JSON:', raw);
    process.exit(1);
  }
}

// ─── Step 2: Sign the intent body ─────────────────────────────────────────
function signBody(body) {
  // Must stringify with consistent key order so bridge can verify
  const payload = JSON.stringify(body, Object.keys(body).sort());
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');
  return { signature, payload };
}

// ─── Step 3: Send to bridge ────────────────────────────────────────────────
async function sendToBridge(payload, signature) {
  console.log('📡 Sending signed intent to bridge...');

  const response = await fetch(`${BRIDGE_URL}/intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LocalBridge-Signature': signature,
    },
    body: payload,
  });

  if (response.status === 401) {
    console.error('\n⚠️  Auth error — you need to link your accounts first.');
    console.error(`   Open this in your browser: ${BRIDGE_URL}/connect/google`);
    process.exit(1);
  }

  if (!response.ok) {
    const err = await response.text();
    console.error(`\nBridge error ${response.status}:`, err);
    process.exit(1);
  }

  return response.json();
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const userPrompt = process.argv.slice(2).join(' ');

  if (!userPrompt) {
    console.log('Usage: node send.js "your prompt here"');
    console.log('');
    console.log('Examples:');
    console.log('  node send.js "Summarise my last 5 unread emails"');
    console.log('  node send.js "What is on my calendar this week?"');
    console.log('  node send.js "List my GitHub repos"');
    process.exit(0);
  }

  console.log(`\nPrompt: "${userPrompt}"`);

  // Step 1 — Groq extracts structured intent
  const intentBody = await extractIntent(userPrompt);
  console.log('\nIntent extracted:');
  console.log(JSON.stringify(intentBody, null, 2));

  // Step 2 — Sign it (Groq/AI layer never sees the HMAC secret)
  const { signature, payload } = signBody(intentBody);
  console.log(`\nSignature: ${signature.slice(0, 16)}... ✓`);

  // Step 3 — Bridge validates signature, fetches tokens, calls APIs
  const result = await sendToBridge(payload, signature);

  console.log('\n✅ Result from bridge:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
