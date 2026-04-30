import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import routes from '@/server/routes';
import { authMiddleware, issueToken } from '@/server/auth';
import { config as globalConfig } from '@/config/env';

function setContractAuth() {
  const originalAuth = { ...globalConfig.auth };
  const originalDbUrl = globalConfig.db.url;
  globalConfig.auth.password = 'hash:secret-123';
  globalConfig.auth.tokenSecret = 'integration-secret';
  globalConfig.db.url = 'postgres://localhost/test';
  return () => {
    globalConfig.auth.password = originalAuth.password;
    globalConfig.auth.tokenSecret = originalAuth.tokenSecret;
    globalConfig.db.url = originalDbUrl;
  };
}

function buildAuthedApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', authMiddleware);
  app.use('/api', routes);
  return app;
}

function patchPoolQuery(handler: (sql: string, params?: any[]) => { rows: any[] }) {
  const original = Pool.prototype.query;
  Pool.prototype.query = (async function (this: Pool, sql: string, params?: any[]) {
    return handler(sql, params);
  }) as any;
  return () => {
    Pool.prototype.query = original;
  };
}

const contractTest = (name: string, fn: Parameters<typeof test>[1]) => test(name, { concurrency: false }, fn as any);

contractTest('POST /api/projects returns 201 with top-level id', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO projects')) {
      return { rows: [{ id: 101, name: 'Project Alpha', status: 'active', summary: null }] };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project Alpha' });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 101);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.item.name, 'Project Alpha');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/messages returns 201 with top-level id', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO conversations')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO messages')) {
      return {
        rows: [{ id: 202, conversation_id: 'default', role: 'user', content: 'hello', created_at: new Date().toISOString() }],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hello' });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 202);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.message.content, 'hello');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/memory returns 201 with top-level id', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO memory_items')) {
      return {
        rows: [{ id: 303, type: 'note', content: 'hello memory', created_at: new Date().toISOString() }],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .post('/api/memory')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'note', content: 'hello memory' });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 303);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.item.content, 'hello memory');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/knowledge returns 201 with top-level id', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO memory_items')) {
      return {
        rows: [{ id: 304, type: 'knowledge', content: 'knowledge base', created_at: new Date().toISOString() }],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .post('/api/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'knowledge', title: 'knowledge base' });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 304);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.item.content, 'knowledge base');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/llm/providers returns 201 with top-level id and no api_key', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO llm_providers')) {
      return {
        rows: [{
          id: 'provider-1',
          name: 'OpenRouter',
          api_key: 'sk-secret',
          base_url: 'https://openrouter.ai/api/v1',
          model: 'gpt-4o-mini',
          priority: 10,
        }],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
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

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 'provider-1');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.item.api_key, undefined);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('GET /api/agents returns enveloped items', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('FROM agents')) {
      return {
        rows: [{ id: 1, name: 'Ops Agent', level: 'Estrategico', status: 'ativo', created_at: new Date().toISOString() }],
      };
    }
    if (sql.includes('FROM agent_skills')) {
      return { rows: [{ agent_id: 1, skill_slug: 'so-expert' }] };
    }
    if (sql.includes('FROM entity_tags')) {
      return { rows: [{ entity_id: 1, name: 'core', color: '#000000' }] };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.items));
    assert.equal(res.body.items[0].skills[0], 'so-expert');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('GET /api/auth/me returns a full user payload', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql, params) => {
    if (sql.includes('FROM user_profile')) {
      return {
        rows: [
          { key: 'profile:andclaw-user:email', value: 'anderson@example.com' },
          { key: 'profile:andclaw-user:fullName', value: 'Anderson Souza' },
          { key: 'profile:andclaw-user:company', value: 'AndClaw' },
        ],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.id, 'andclaw-user');
    assert.equal(res.body.email, 'anderson@example.com');
    assert.equal(res.body.fullName, 'Anderson Souza');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/captures creates rows with status new', async () => {
  const restoreConfig = setContractAuth();
  let capturedStatus: string | undefined;
  const restoreQuery = patchPoolQuery((sql, params = []) => {
    if (sql.includes('INSERT INTO captures')) {
      capturedStatus = String(params[7]);
      return {
        rows: [{
          id: 505,
          content: 'capture content',
          source: 'pwa',
          type: 'note',
          status: params[7],
          created_at: new Date().toISOString(),
        }],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .post('/api/captures')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'capture content' });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 505);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.item.status, 'new');
    assert.equal(capturedStatus, 'new');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});
