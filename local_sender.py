#!/usr/bin/env python3
"""
local_sender.py — runs on the user's machine alongside the local LLM.

This is the on-device side of LocalBridge. It:
  1. Takes a plain-text user prompt
  2. Sends it to a local Ollama model to extract structured intent JSON
  3. Signs the intent with HMAC-SHA256 using the shared BRIDGE_HMAC_SECRET
  4. POSTs it to the bridge — no OAuth token ever touches this machine

Usage:
  python local_sender.py "Summarise my last 5 unread emails"

Requirements:
  pip install requests ollama python-dotenv
"""

import hashlib
import hmac
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BRIDGE_URL = os.getenv("BRIDGE_URL", "http://localhost:3000")
BRIDGE_HMAC_SECRET = os.getenv("BRIDGE_HMAC_SECRET", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")

SYSTEM_PROMPT = """
You are an intent extraction engine for LocalBridge. 
Given a user request, output ONLY valid JSON — no explanation, no markdown fences.

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

A single user request can produce multiple intents if needed.
Always output raw JSON only. Never include markdown, backticks, or prose.
""".strip()


def extract_intent(user_prompt: str) -> dict:
    """Call the local Ollama model and parse the intent JSON."""
    try:
        import ollama
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response["message"]["content"].strip()
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Model returned invalid JSON: {e}")
        print(f"Raw output: {raw}")
        sys.exit(1)
    except Exception as e:
        print(f"Ollama error: {e}")
        print("Is Ollama running? Try: ollama serve")
        sys.exit(1)


def sign_body(body: dict) -> str:
    """HMAC-SHA256 sign the JSON body with the shared secret."""
    if not BRIDGE_HMAC_SECRET:
        print("Error: BRIDGE_HMAC_SECRET not set in .env")
        sys.exit(1)
    payload = json.dumps(body, separators=(",", ":"), sort_keys=True)
    sig = hmac.new(
        BRIDGE_HMAC_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return sig, payload


def send_intent(body: dict, signature: str, raw_payload: str):
    """POST the signed intent to the bridge."""
    response = requests.post(
        f"{BRIDGE_URL}/intent",
        data=raw_payload,                       # send exactly what we signed
        headers={
            "Content-Type": "application/json",
            "X-LocalBridge-Signature": signature,
        },
    )
    if response.status_code == 401:
        print("Auth error — have you logged in at the bridge? Visit:")
        print(f"  {BRIDGE_URL}/connect/google")
        sys.exit(1)
    if not response.ok:
        print(f"Bridge error {response.status_code}: {response.text}")
        sys.exit(1)
    return response.json()


def main():
    if len(sys.argv) < 2:
        print('Usage: python local_sender.py "your prompt here"')
        sys.exit(1)

    user_prompt = " ".join(sys.argv[1:])
    print(f"\nPrompt: {user_prompt}")
    print("Extracting intent from local model...")

    intent_body = extract_intent(user_prompt)
    print(f"Intent: {json.dumps(intent_body, indent=2)}")

    signature, raw_payload = sign_body(intent_body)
    print(f"Signature: {signature[:16]}...")
    print("Sending to bridge...")

    result = send_intent(intent_body, signature, raw_payload)
    print("\nResult from bridge:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
