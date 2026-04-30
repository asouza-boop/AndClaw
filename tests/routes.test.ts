import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import routes from '@/server/routes';
import { authMiddleware, issueToken } from '@/server/auth';
import { config as globalConfig } from '@/config/env';

test('POST /api/llm/providers never exposes api_key and GET results are masked', async () => {
  const originalQuery = Pool.prototype.query;
  const originalAuth = { ...globalConfig.auth };
  const originalDbUrl = globalConfig.db.url;

  globalConfig.auth.password = 'hash:secret-123';
  globalConfig.auth.tokenSecret = 'integration-secret';
  globalConfig.db.url = 'postgres://localhost/test';

  const rows = [
    {
      id: 'provider-1',
      name: 'OpenRouter',
      api_key: 'sk-secret',
      base_url: 'https://openrouter.ai/api/v1',
      model: 'gpt-4o-mini',
      priority: 10,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  (Pool.prototype as any).query = async function (text: string) {
    if (text.includes('INSERT INTO llm_providers')) return { rows: [{ ...rows[0] }] };
    if (text.includes('SELECT * FROM llm_providers')) return { rows: rows.map((row) => ({ ...row })) };
    return { rows: [] };
  };

  const token = issueToken('andclaw-user');
  const app = express();
  app.use(express.json());
  app.use('/api', authMiddleware);
  app.use('/api', routes);

  try {
    const created = await request(app)
      .post('/api/llm/providers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'provider-1',
        name: 'OpenRouter',
        api_key: 'sk-secret',
        base_url: 'https://openrouter.ai/api/v1',
        model: 'gpt-4o-mini',
        priority: 10,
      });

    assert.equal(created.status, 201);
    assert.equal(created.body.item.api_key, undefined);
    assert.equal(Object.hasOwn(created.body.item, 'api_key'), false);
    assert.equal(created.body.id, 'provider-1');

    const list = await request(app)
      .get('/api/llm/providers')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(list.status, 200);
    assert.equal(list.body.items[0].api_key, undefined);
    assert.equal(Object.hasOwn(list.body.items[0], 'api_key'), false);
  } finally {
    (Pool.prototype as any).query = originalQuery;
    globalConfig.auth.password = originalAuth.password;
    globalConfig.auth.tokenSecret = originalAuth.tokenSecret;
    globalConfig.db.url = originalDbUrl;
  }
});
