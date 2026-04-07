import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { createSystemRoutes } from '@/server/system-routes';

function baseConfig(overrides: Partial<any> = {}) {
  return {
    env: 'test',
    telegram: { token: '', allowedUsers: [] },
    agent: { userName: 'usuário' },
    llm: {
      geminiKey: 'gemini-key',
      geminiKey2: '',
      geminiKey3: '',
      deepseekKey: '',
      openrouterKey: '',
      ollamaModel: 'llama3.2',
      defaultProvider: 'gemini',
      providerChain: ['gemini'],
      maxIterations: 2,
    },
    db: { url: 'postgres://localhost/test' },
    server: { port: 3000, allowedOrigin: '', frontendUrl: '' },
    google: {
      accountsJson: '[]',
      oauthClientId: 'google-client',
      oauthClientSecret: 'google-secret',
      oauthRedirectUri: 'http://localhost/auth/callback',
      exportCalendarId: 'primary',
      calendarSyncInterval: 30,
    },
    auth: { password: 'hash:secret-123', tokenSecret: 'generated-secret-generated-secret' },
    gitvault: { repo: 'owner/repo', token: 'github-token', basePath: 'daily' },
    push: { vapidPublicKey: 'pub', vapidPrivateKey: 'priv', contactEmail: 'mailto:test@example.com' },
    raindrop: { token: 'raindrop-token', collectionId: '42' },
    paths: { db: '', skills: '', tmp: '' },
    ...overrides,
  } as any;
}

test('system routes expose healthy runtime and structured status', async () => {
  const deps = {
    config: baseConfig(),
    ensureSchema: async () => {},
    loadAppSettings: async () => ({
      DEFAULT_LLM_PROVIDER: 'gemini',
      GITVAULT_BASE_PATH: 'daily',
    }),
    query: async (sql: string) => {
      if (sql.includes('SELECT 1 as ok')) return [{ ok: 1 }];
      return [];
    },
    getRequestId: () => 'request-1',
    sendApiError: (_res: any, status: number, error: string, message: string, extras: Record<string, unknown> = {}) => ({
      status,
      error,
      message,
      extras,
    }),
    setRetryHeaders: (res: any, retryable: boolean, retryAfterMs?: number) => {
      res.setHeader('X-Retryable', retryable ? 'true' : 'false');
      if (retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    },
  };

  const app = express();
  app.use('/api', createSystemRoutes(deps as any));

  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers['x-retryable'], 'false');
  assert.deepEqual(health.body, { ok: true, status: 'healthy', requestId: 'request-1' });

  const runtime = await request(app).get('/api/health/runtime');
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.ready, true);
  assert.equal(runtime.body.db.ok, true);
  assert.equal(runtime.body.llm.configured, true);

  const status = await request(app).get('/api/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.ready, true);
  assert.equal(status.body.integrations.google.configured, true);
  assert.equal(status.body.integrations.gitvault.configured, true);
  assert.equal(status.body.integrations.push.configured, true);
  assert.equal(status.body.integrations.raindrop.configured, true);
});

test('system routes signal retry when runtime is not ready', async () => {
  const deps = {
    config: baseConfig({
      auth: { password: '', tokenSecret: '' },
      llm: { geminiKey: '', geminiKey2: '', geminiKey3: '', deepseekKey: '', openrouterKey: '', ollamaModel: 'llama3.2', defaultProvider: 'gemini', providerChain: ['gemini'], maxIterations: 2 },
    }),
    ensureSchema: async () => {},
    loadAppSettings: async () => ({}),
    query: async () => {
      throw new Error('database_unavailable');
    },
    getRequestId: () => 'request-2',
    sendApiError: (res: any, status: number, error: string, message: string, extras: Record<string, unknown> = {}) => {
      res.status(status).json({ ok: false, error, message, ...extras });
      return null;
    },
    setRetryHeaders: (res: any, retryable: boolean, retryAfterMs?: number) => {
      res.setHeader('X-Retryable', retryable ? 'true' : 'false');
      if (retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    },
  };

  const app = express();
  app.use('/api', createSystemRoutes(deps as any));

  const runtime = await request(app).get('/api/health/runtime');
  assert.equal(runtime.status, 503);
  assert.equal(runtime.headers['x-retryable'], 'true');
  assert.equal(runtime.headers['retry-after'], '30');
  assert.equal(runtime.body.error, 'runtime_not_ready');
  assert.equal(runtime.body.retryable, true);
});
