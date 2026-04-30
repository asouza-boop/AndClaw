import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { createAuthRoutes } from '@/server/auth-routes';

test('POST /api/auth/bootstrap omits tokenSecret from the response body', async () => {
  const store = new Map<string, string>();
  const deps = {
    query: async () => [] as any[],
    config: {
      env: 'test',
      telegram: { token: '', allowedUsers: [] },
      agent: { userName: 'usuário' },
      llm: {
        geminiKey: '',
        geminiKey2: '',
        geminiKey3: '',
        deepseekKey: '',
        openrouterKey: '',
        ollamaModel: 'llama3.2',
        defaultProvider: 'gemini',
        providerChain: ['gemini'],
        maxIterations: 2,
      },
      db: { url: '' },
      server: { port: 3000, allowedOrigin: '', frontendUrl: '' },
      google: {
        accountsJson: '[]',
        oauthClientId: '',
        oauthClientSecret: '',
        oauthRedirectUri: '',
        exportCalendarId: 'primary',
        calendarSyncInterval: 30,
      },
      auth: { password: '', tokenSecret: '' },
      gitvault: { repo: '', token: '', basePath: 'daily' },
      push: { vapidPublicKey: '', vapidPrivateKey: '', contactEmail: 'mailto:test@example.com' },
      raindrop: { token: '', collectionId: '0' },
      paths: { db: '', skills: '', tmp: '' },
    } as any,
    issueToken: () => 'token-123',
    verifyLoginPassword: () => true,
    loadAuthFromDb: async () => {},
    setSetting: async (key: string, value: string) => {
      store.set(key, value);
    },
    hashPassword: (value: string) => `hash:${value}`,
    randomSecret: () => 'generated-secret-generated-secret',
  };

  const app = express();
  app.use(express.json());
  app.use('/api', createAuthRoutes(deps as any));

  const response = await request(app)
    .post('/api/auth/bootstrap')
    .send({ password: 'secret-123' });

  assert.equal(response.status, 200);
  assert.equal(response.body.token, 'token-123');
  assert.equal(Object.hasOwn(response.body, 'tokenSecret'), false);
});
