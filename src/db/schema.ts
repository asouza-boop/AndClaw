import { query } from './postgres';

export async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      client_message_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS captures (
      id BIGSERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'pwa',
      status TEXT DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      due_date TIMESTAMPTZ,
      project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
      meeting_id BIGINT,
      gcal_event_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      meeting_date TIMESTAMPTZ,
      transcript_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS memory_items (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      source_type TEXT,
      source_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id BIGSERIAL PRIMARY KEY,
      account_email TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      external_event_id TEXT NOT NULL,
      summary TEXT,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (account_email, calendar_id, external_event_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id BIGSERIAL PRIMARY KEY,
      account_email TEXT UNIQUE,
      refresh_token TEXT NOT NULL,
      access_token TEXT,
      expires_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      keys JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS job_runs (
      id BIGSERIAL PRIMARY KEY,
      job_name TEXT UNIQUE NOT NULL,
      last_run_at TIMESTAMPTZ
    );
  `);
}
