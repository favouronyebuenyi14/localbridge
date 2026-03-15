# LocalBridge

A secure intent router that lets a local LLM call cloud APIs without ever
holding an OAuth token. Built for the Auth0 "Authorized to Act" Hackathon.

## How it works

```
Local LLM  →  signed intent  →  Bridge (Node.js)  →  Auth0 Token Vault  →  Gmail / GitHub / Calendar
   (no tokens)                   (validates HMAC)      (token exchange)       (real API calls)
```

The local model never sees an OAuth token. The bridge holds the user's Auth0
session, exchanges it for short-lived provider tokens via Token Vault, executes
the API call, strips the token, and returns only the data.

## Quick start

### 1. Bridge setup

```bash
cp .env.example .env
# Fill in your Auth0 values in .env

npm install
npm run dev
```

### 2. Connect your accounts

Open your browser and visit:
- `http://localhost:3000/connect/google` — links Gmail + Calendar
- `http://localhost:3000/connect/github` — links GitHub

### 3. Local model setup (Python)

```bash
pip install requests ollama python-dotenv
# Make sure Ollama is running: ollama serve
# Pull a model: ollama pull mistral
```

Add to your `.env` (or a separate local `.env`):
```
BRIDGE_URL=http://localhost:3000
BRIDGE_HMAC_SECRET=same-value-as-bridge
OLLAMA_MODEL=mistral
```

### 4. Send your first intent

```bash
python local_sender.py "Summarise my last 5 unread emails"
python local_sender.py "List my GitHub repos"
python local_sender.py "What's on my calendar this week?"
```

## Intent schema

The bridge accepts `POST /intent` with a JSON body:

```json
{
  "intents": [
    { "agent": "comms",    "action": "read_emails",  "params": { "maxResults": 5 } },
    { "agent": "calendar", "action": "list_events",  "params": {} },
    { "agent": "github",   "action": "create_issue", "params": { "repo": "owner/repo", "title": "Fix bug" } }
  ]
}
```

The `X-LocalBridge-Signature` header must be:
```
HMAC-SHA256(JSON.stringify(body), BRIDGE_HMAC_SECRET)
```

## Available agents

| Agent    | Actions                        | Connection     |
|----------|-------------------------------|----------------|
| comms    | read_emails, send_email        | google-oauth2  |
| calendar | list_events, create_event      | google-oauth2  |
| github   | list_repos, create_issue       | github         |

## Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Then update `AUTH0_BASE_URL` in your `.env` and Auth0 callback URLs
to your Railway domain.
