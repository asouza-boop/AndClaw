import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { ensureSchema } from '@/db/schema';
import { up as tasksMetadataMigration } from '@/db/migrations/20260430_add_tasks_metadata';
import { TaskService } from '@/core/agent/TaskService';
import { config as globalConfig } from '@/config/env';

test('tasks schema includes metadata in bootstrap and migration SQL', async () => {
  const originalQuery = Pool.prototype.query;
  const statements: string[] = [];
  globalConfig.db.url = 'postgres://localhost/test';

  (Pool.prototype as any).query = async function (text: string) {
    statements.push(String(text));
    return { rows: [] };
  };

  try {
    await ensureSchema();
  } finally {
    (Pool.prototype as any).query = originalQuery;
  }

  assert.ok(statements.some((sql) => sql.includes('metadata JSONB')));
  assert.match(tasksMetadataMigration, /ADD COLUMN IF NOT EXISTS metadata JSONB/);
});

test('TaskService.createFromMeetingAction resolves with metadata-backed inserts', async () => {
  const originalQuery = Pool.prototype.query;
  const statements: string[] = [];
  globalConfig.db.url = 'postgres://localhost/test';

  (Pool.prototype as any).query = async function (text: string, params: any[] = []) {
    statements.push(String(text));
    if (String(text).includes('SELECT id FROM tasks')) return { rows: [] };
    if (String(text).includes('INSERT INTO tasks')) return { rows: [{ id: 1, title: params[0] }] };
    return { rows: [] };
  };

  try {
    await assert.doesNotReject(() => TaskService.createFromMeetingAction(42, 'Follow up on roadmap'));
  } finally {
    (Pool.prototype as any).query = originalQuery;
  }

  assert.ok(statements.some((sql) => sql.includes('metadata->>\'meeting_id\'')));
  assert.ok(statements.some((sql) => sql.includes('INSERT INTO tasks (title, status, metadata)')));
});
