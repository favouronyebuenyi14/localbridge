import { getTokenForConnection } from '../middleware/tokenVault.js';

// GitHub agent: handles repo and issue intents
// Scopes used: repo, user
// This agent is a good demo of step-up auth — creating issues is a
// write action and should require user confirmation in the full demo.

export async function githubAgent(req, intent) {
  const token = await getTokenForConnection(req, 'github');

  switch (intent.action) {
    case 'list_repos':
      return listRepos(token);
    case 'create_issue':
      return createIssue(token, intent.params);
    default:
      return { error: `Unknown github action: ${intent.action}` };
  }
}

async function listRepos(token) {
  const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=10', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) throw new Error(`GitHub list repos failed: ${await res.text()}`);

  const repos = await res.json();
  return {
    agent: 'github',
    action: 'list_repos',
    result: repos.map(r => ({ name: r.full_name, url: r.html_url, private: r.private })),
  };
}

async function createIssue(token, params = {}) {
  const { repo, title, body } = params;

  if (!repo || !title) {
    return { error: 'create_issue requires repo (owner/repo) and title params' };
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body: body || '' }),
  });

  if (!res.ok) throw new Error(`GitHub create issue failed: ${await res.text()}`);

  const issue = await res.json();
  return {
    agent: 'github',
    action: 'create_issue',
    result: { number: issue.number, title: issue.title, url: issue.html_url },
  };
}
