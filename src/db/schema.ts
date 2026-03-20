import { query } from './postgres';

export async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      provider TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS user_profile (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
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

  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS agents (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT DEFAULT 'Estrategico',
      status TEXT DEFAULT 'ativo',
      areas TEXT[] DEFAULT '{}',
      description TEXT,
      base_doc TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id BIGINT REFERENCES agents(id) ON DELETE CASCADE,
      skill_slug TEXT NOT NULL,
      UNIQUE (agent_id, skill_slug)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tags (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS entity_tags (
      tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      UNIQUE (tag_id, entity_type, entity_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS page_links (
      id BIGSERIAL PRIMARY KEY,
      from_type TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      label TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      external_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_source_external ON favorites(source, external_id)`);

  await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id TEXT`);
  await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS provider TEXT`);
  await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS role TEXT`);

  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`);

  // Migrations / Fixes
  await query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS base_doc TEXT`);
  await query(`ALTER TABLE captures ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'note'`);
  await query(`ALTER TABLE captures ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);
  await query(`ALTER TABLE captures ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE captures ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ`);
}
