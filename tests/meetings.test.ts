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
const { MeetingService } = require('../src/core/agent/MeetingService');
const { agentEvents, MEETING_MUTATED, TASK_MUTATED } = require('../src/core/events/AgentEvents');
const { registerCalendarSyncListener } = require('../src/core/listeners/CalendarSyncListener');
const { logger } = require('../src/infra/logger');
const { google } = require('googleapis');
const { agent } = require('../src/server/routes/shared');
const { MemoryManager } = require('../src/memory/MemoryManager');
const { encrypt } = require('../src/lib/crypto');

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

contractTest('POST /api/meetings with date alias maps to meeting_date', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql, params) => {
    if (sql.includes('INSERT INTO meetings')) {
      return {
        rows: [{
          id: 11,
          title: params?.[0],
          meeting_date: params?.[1],
          transcript_text: null,
          status: params?.[3],
          duration: params?.[4],
          participants: params?.[5],
          summary: params?.[6],
          action_items: [],
          skills_used: [],
          notes: params?.[9],
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
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Alias Test', date: '2026-06-01T10:00:00Z' });

    assert.equal(res.status, 201);
    assert.ok(res.body.item.date !== null && res.body.item.date !== undefined);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/meetings with start alias maps to meeting_date', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql, params) => {
    if (sql.includes('INSERT INTO meetings')) {
      return {
        rows: [{
          id: 12,
          title: params?.[0],
          meeting_date: params?.[1],
          transcript_text: null,
          status: params?.[3],
          duration: params?.[4],
          participants: params?.[5],
          summary: params?.[6],
          action_items: [],
          skills_used: [],
          notes: params?.[9],
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
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Start Alias', start: '2026-06-01T09:00:00Z' });

    assert.equal(res.status, 201);
    assert.ok(res.body.item.date !== null && res.body.item.date !== undefined);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('GET /api/meetings surfaces DB errors through errorHandler', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('FROM meetings')) {
      throw new Error('db_failure');
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .get('/api/meetings')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 500);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/meetings/:id/upload-audio returns 400 without a file', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery(() => ({ rows: [] }));
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();

  try {
    const res = await request(app)
      .post('/api/meetings/1/upload-audio')
      .set('Authorization', `Bearer ${token}`)
      .send({ any: 'body' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'No audio file received');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/meetings/:id/process?action=transcribe returns 400 without audio', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('FROM meetings')) {
      return {
        rows: [{
          id: 1,
          title: 'Transcribe Stub',
          meeting_date: new Date('2026-06-01T09:00:00Z').toISOString(),
          transcript_text: null,
          status: 'scheduled',
          duration: null,
          participants: [],
          summary: null,
          action_items: [],
          decisions: [],
          ideas: [],
          skills_used: [],
          notes: null,
          audio_file_name: null,
          gcal_event_id: null,
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
      .post('/api/meetings/1/process')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'transcribe' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'No audio file available for transcription');
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('POST /api/meetings/analyze persists via MemoryManager', async () => {
  const restoreConfig = setContractAuth();
  const sqlCalls = [];
  const restoreQuery = patchPoolQuery((sql) => {
    sqlCalls.push(sql);
    if (sql.includes('SELECT * FROM meetings WHERE id = $1')) {
      return {
        rows: [{
          id: 1,
          title: 'Analyze Meeting',
          meeting_date: new Date('2026-06-01T09:00:00Z').toISOString(),
          transcript_text: 'Discuss roadmap',
          status: 'scheduled',
          duration: 30,
          participants: ['a@example.com'],
          summary: null,
          action_items: [],
          decisions: [],
          ideas: [],
          skills_used: [],
          notes: null,
          audio_file_name: null,
          gcal_event_id: null,
          created_at: new Date().toISOString(),
        }],
      };
    }
    if (sql.includes('UPDATE meetings SET summary = $1 WHERE id = $2')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO memory_items')) {
      return { rows: [] };
    }
    return { rows: [] };
  });
  const token = issueToken('andclaw-user');
  const app = buildAuthedApp();
  const originalProcessInput = agent.processInput;
  const originalAddSemanticMemory = MemoryManager.prototype.addSemanticMemory;
  const calls = [];

  MemoryManager.prototype.addSemanticMemory = async function (content, metadata) {
    calls.push({ content, metadata });
    return null;
  };
  agent.processInput = async () => 'analysis output';

  try {
    const res = await request(app)
      .post('/api/meetings/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ meetingId: 1 });

    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].metadata.source, 'meeting');
    assert.equal(calls[0].metadata.type, 'meeting_insight');
    assert.equal(sqlCalls.some((sql) => sql.includes('INSERT INTO memory_items')), false);
  } finally {
    restoreQuery();
    restoreConfig();
    MemoryManager.prototype.addSemanticMemory = originalAddSemanticMemory;
    agent.processInput = originalProcessInput;
  }
});

contractTest('MeetingService.processIntelligence rolls back on parse failure', async () => {
  const restoreConfig = setContractAuth();
  const sqlCalls = [];
  const restoreQuery = patchPoolQuery((sql) => {
    sqlCalls.push(sql);
    return { rows: [] };
  });
  const mockAgent = {
    processInput: async () => 'not json',
  };

  try {
    await assert.rejects(
      () => MeetingService.processIntelligence('1', 'bad transcript', mockAgent),
    );

    assert.ok(sqlCalls.includes('ROLLBACK'));
    assert.equal(sqlCalls.some((sql) => sql.includes('INSERT INTO tasks')), false);
  } finally {
    restoreQuery();
    restoreConfig();
  }
});

contractTest('CalendarSyncListener skips invalid dates', async () => {
  const restoreConfig = setContractAuth();
  const restoreQuery = patchPoolQuery((sql) => {
    if (sql.includes('FROM oauth_tokens')) {
      return {
        rows: [{
          account_email: 'calendar@example.com',
          refresh_token: encrypt('refresh-token'),
        }],
      };
    }
    return { rows: [] };
  });
  const originalWarn = logger.warn;
  const originalCalendar = google.calendar;
  const warnCalls = [];
  let calendarCalled = false;

  logger.warn = (event, payload = {}) => {
    warnCalls.push({ event, payload });
  };
  google.calendar = (..._args) => {
    calendarCalled = true;
    return {
      events: {
        insert: async () => ({ data: {} }),
        patch: async () => ({ data: {} }),
      },
    };
  };

  try {
    registerCalendarSyncListener();
    agentEvents.emit(MEETING_MUTATED, { meetingId: '99', start_time: 'not-a-date', title: 'Bad Date' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calendarCalled, false);
    assert.ok(warnCalls.some((call) => call.event === 'calendar.sync.invalid_date'));
  } finally {
    agentEvents.removeAllListeners(MEETING_MUTATED);
    agentEvents.removeAllListeners(TASK_MUTATED);
    restoreQuery();
    restoreConfig();
    logger.warn = originalWarn;
    google.calendar = originalCalendar;
  }
});
