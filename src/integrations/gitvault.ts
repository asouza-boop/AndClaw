import { config } from '../config/env';
import { query } from '../db/postgres';
import { ensureSchema } from '../db/schema';

function requireGitVaultConfig() {
  if (!config.gitvault.repo || !config.gitvault.token) {
    throw new Error('GITVAULT_REPO or GITHUB_TOKEN not configured.');
  }
}

async function githubRequest(path: string, method: string, body?: any) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${config.gitvault.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${text}`);
  }

  return response.json();
}

async function getFileSha(path: string): Promise<string | null> {
  try {
    const data = await githubRequest(`/repos/${config.gitvault.repo}/contents/${path}`, 'GET');
    return data.sha || null;
  } catch {
    return null;
  }
}

async function upsertFile(path: string, content: string, message: string) {
  const sha = await getFileSha(path);
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    sha: sha || undefined,
  };
  await githubRequest(`/repos/${config.gitvault.repo}/contents/${path}`, 'PUT', body);
}

export async function exportDailyGitVault(): Promise<void> {
  requireGitVaultConfig();
  await ensureSchema();

  const today = new Date().toISOString().slice(0, 10);
  const basePath = `${config.gitvault.basePath}/${today}`;

  const messages = await query<any>(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 200`);
  const meetings = await query<any>(`SELECT * FROM meetings ORDER BY created_at DESC LIMIT 50`);
  const memory = await query<any>(`SELECT * FROM memory_items ORDER BY created_at DESC LIMIT 100`);

  const content = [
    `# AndClaw Daily Export (${today})`,
    '',
    `## Messages (${messages.length})`,
    ...messages.map(m => `- [${m.created_at}] ${m.sender}: ${m.content}`),
    '',
    `## Meetings (${meetings.length})`,
    ...meetings.map(m => `- [${m.created_at}] ${m.title}`),
    '',
    `## Memory Items (${memory.length})`,
    ...memory.map(mi => `- [${mi.created_at}] (${mi.type}) ${mi.content}`),
    ''
  ].join('\n');

  await upsertFile(`${basePath}/daily.md`, content, `GitVault export ${today}`);
}
