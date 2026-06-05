require('tsx/cjs');

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { Pool } = require('pg');
const routes = require('../src/server/routes').default;
const { authMiddleware, issueToken } = require('../src/server/auth');
const { config: globalConfig } = require('../src/config/env');
const { errorHandler } = require('../src/server/error-handler');
const { TaskService } = require('../src/core/agent/TaskService');
const { agent } = require('../src/server/routes/shared');

function setContractAuth() {
  const originalAuth = { ...globalConfig.auth };
  const originalDbUrl = globalConfig.db.url;
  const originalLlm = { ...globalConfig.llm };
  globalConfig.auth.password = 'hash:secret-123';
  globalConfig.auth.tokenSecret = 'integration-secret';
  globalConfig.db.url = 'postgres://localhost/test';
  globalConfig.llm.geminiKey = 'test-gemini-key';
  return () => {
    globalConfig.auth.password = originalAuth.password;
    globalConfig.auth.tokenSecret = originalAuth.tokenSecret;
    globalConfig.db.url = originalDbUrl;
    globalConfig.llm.geminiKey = originalLlm.geminiKey;
    globalConfig.llm.geminiKey2 = originalLlm.geminiKey2;
    globalConfig.llm.geminiKey3 = originalLlm.geminiKey3;
    globalConfig.llm.deepseekKey = originalLlm.deepseekKey;
    globalConfig.llm.openrouterKey = originalLlm.openrouterKey;
  };
}

function buildAuthedApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', authMiddleware);
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

function patchPoolQuery(handler) {
  const original = Pool.prototype.query;
  Pool.prototype.query = async function (sql, params) {
    return handler(sql, params);
  };
  return () => {
    Pool.prototype.query = original;
  };
}

const contractTest = (name, fn) => test(name, { concurrency: false }, fn);

contractTest('POST /api/captures creates row and returns 201', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO captures')) {
      return {
        rows: [{
          id: 1,
          content: 'test note',
          source: 'pwa',
          type: 'note',
          status: 'new',
          metadata: {},
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
      .send({ content: 'test note', type: 'note' });

    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/captures/smart returns 201 immediately', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('INSERT INTO captures')) {
      return {
        rows: [{
          id: 2,
          content: 'schedule a meeting with team',
          source: 'pwa',
          type: 'note',
          status: 'processing',
          metadata: { isProcessing: true },
          created_at: new Date().toISOString(),
        }],
      };
    }
    if (sql.includes('UPDATE captures SET type = $1, metadata = $2, status = \'new\' WHERE id = $3')) {
      return { rows: [] };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();
  const originalProcessInput = agent.processInput;
  agent.processInput = async () => '{"type":"note","summary":"ok","evolution":["keep"]}';

  try {
    const res = await request(app)
      .post('/api/captures/smart')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'schedule a meeting with team' });

    assert.equal(res.status, 201);
    assert.ok(String(res.body.message).includes('background'));
  } finally {
    restoreQuery();
    restoreConfig();
    agent.processInput = originalProcessInput;
  }
});

contractTest('PATCH /api/captures/:id with type=task does not mark processed before bridge', async () => {
  const restoreConfig = setContractAuth();
  const sqlCalls = [];
  const restoreQuery = patchPoolQuery((sql) => {
    sqlCalls.push(sql);
    if (sql.includes('SELECT * FROM captures WHERE id = $1') && sqlCalls.length === 1) {
      return {
        rows: [{
          id: 1,
          type: 'note',
          status: 'new',
          content: 'test',
        }],
      };
    }
    if (sql.startsWith('UPDATE captures SET') && !sql.includes('status = \'processed\'')) {
      return {
        rows: [{
          id: 1,
          type: 'task',
          status: 'new',
          content: 'test',
        }],
      };
    }
    if (sql.includes('UPDATE captures SET status = \'processed\', processed_at = NOW() WHERE id = $1')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT * FROM captures WHERE id = $1')) {
      return {
        rows: [{
          id: 1,
          type: 'task',
          status: 'processed',
          content: 'test',
        }],
      };
    }
    return { rows: [] };
  });
  const originalCreateFromCapture = TaskService.createFromCapture;
  let createFromCaptureCalled = false;
  TaskService.createFromCapture = async (capture) => {
    createFromCaptureCalled = true;
    assert.equal(capture.type, 'task');
    return null;
  };
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .patch('/api/captures/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'task' });

    assert.equal(res.status, 200);
    assert.equal(createFromCaptureCalled, true);
    const bridgeIndex = sqlCalls.findIndex((sql) => sql.includes('UPDATE captures SET status = \'processed\', processed_at = NOW() WHERE id = $1'));
    const firstUpdateIndex = sqlCalls.findIndex((sql) => sql.startsWith('UPDATE captures SET'));
    assert.ok(firstUpdateIndex >= 0);
    assert.ok(bridgeIndex > firstUpdateIndex);
  } finally {
    restoreQuery();
    restoreConfig();
    TaskService.createFromCapture = originalCreateFromCapture;
  }
});

contractTest('POST /api/captures/bulk action=extract with invalid JSON returns 500', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('SELECT * FROM captures WHERE id = ANY($1) AND status != \'processed\'')) {
      return {
        rows: [{
          id: 1,
          content: 'test',
          status: 'new',
        }],
      };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();
  const originalProcessInput = agent.processInput;
  agent.processInput = async () => 'not json at all';

  try {
    const res = await request(app)
      .post('/api/captures/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'extract', ids: [1] });

    assert.equal(res.status, 500);
    assert.equal(res.body.code, 'PARSE_FAILED');
  } finally {
    restoreQuery();
    restoreConfig();
    agent.processInput = originalProcessInput;
  }
});

contractTest('POST /api/captures with type=tool is sanitized to note', async () => {
  const restoreConfig = setContractAuth();
  let insertParams = null;
  const restoreQuery = patchPoolQuery((sql, params) => {
    if (sql.includes('INSERT INTO captures')) {
      insertParams = params;
      return {
        rows: [{
          id: 1,
          content: 'test',
          source: 'pwa',
          type: 'note',
          status: 'new',
          metadata: {},
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
      .send({ content: 'test', type: 'tool' });

    assert.equal(res.status, 201);
    assert.equal(res.body.item.type, 'note');
    assert.equal(insertParams?.[2], 'note');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('PATCH /api/captures/:id with type=tool returns 400', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery(() => ({ rows: [] }));
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .patch('/api/captures/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'tool' });

    assert.equal(res.status, 400);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('GET /api/captures surfaces DB errors through errorHandler', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('FROM captures')) {
      throw new Error('db_failure');
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .get('/api/captures')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 500);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});
