import fs from 'fs';
import path from 'path';

const API_BASE = process.env.ANDCLAW_API_BASE_URL || '';
const PASSWORD = process.env.ANDCLAW_PASSWORD || '';
const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || path.join(process.cwd(), 'transcripts');
const PROCESSED_DIR = process.env.PROCESSED_DIR || path.join(TRANSCRIPTS_DIR, 'processed');

async function login(): Promise<string> {
  if (!API_BASE) throw new Error('ANDCLAW_API_BASE_URL not set');
  if (!PASSWORD) throw new Error('ANDCLAW_PASSWORD not set');
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD })
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function uploadTranscript(filePath: string, token: string) {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const title = path.basename(filePath, path.extname(filePath));

  const res = await fetch(`${API_BASE}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title, transcript_text: content })
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

async function moveToProcessed(filePath: string) {
  await fs.promises.mkdir(PROCESSED_DIR, { recursive: true });
  const dest = path.join(PROCESSED_DIR, path.basename(filePath));
  await fs.promises.rename(filePath, dest);
}

async function scanAndUpload(token: string) {
  await fs.promises.mkdir(TRANSCRIPTS_DIR, { recursive: true });
  const entries = await fs.promises.readdir(TRANSCRIPTS_DIR);
  for (const entry of entries) {
    if (!entry.endsWith('.txt')) continue;
    const filePath = path.join(TRANSCRIPTS_DIR, entry);
    try {
      await uploadTranscript(filePath, token);
      await moveToProcessed(filePath);
      console.log(`[transcripts] uploaded ${entry}`);
    } catch (err: any) {
      console.error(`[transcripts] failed ${entry}:`, err.message);
    }
  }
}

async function main() {
  const token = await login();
  await scanAndUpload(token);

  fs.watch(TRANSCRIPTS_DIR, async (_event, filename) => {
    if (!filename || !filename.endsWith('.txt')) return;
    const token = await login();
    const filePath = path.join(TRANSCRIPTS_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    try {
      await uploadTranscript(filePath, token);
      await moveToProcessed(filePath);
      console.log(`[transcripts] uploaded ${filename}`);
    } catch (err: any) {
      console.error(`[transcripts] failed ${filename}:`, err.message);
    }
  });

  console.log(`[transcripts] watching ${TRANSCRIPTS_DIR}`);
}

main().catch((err) => {
  console.error('[transcripts] fatal:', err);
  process.exit(1);
});
