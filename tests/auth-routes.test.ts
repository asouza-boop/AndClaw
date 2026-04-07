import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { createAuthRoutes } from '@/server/auth-routes';

function createAuthDeps() {
  const store = new Map<string, string>();
  const config = {
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
  } as any;

  const query = async <T,>(sql: string, params: any[] = []) => {
    if (sql.includes('FROM user_profile')) {
      const prefix = String(params[0]).replace(/%$/, '');
      return Array.from(store.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value })) as T[];
    }
    if (sql.includes('INSERT INTO user_profile')) {
      const [key, value] = params as [string, string];
      store.set(key, value);
      return [] as T[];
    }
    return [] as T[];
  };

  return {
    store,
    config,
    query,
    issueToken: () => 'token-123',
    verifyLoginPassword: (password: string) => password === 'secret-123',
    loadAuthFromDb: async () => {},
    setSetting: async (key: string, value: string) => {
      store.set(key, value);
    },
    hashPassword: (value: string) => `hash:${value}`,
    randomSecret: () => 'generated-secret-generated-secret',
  };
}

test('auth routes bootstrap, login and profile persistence', async () => {
  const deps = createAuthDeps();
  const app = express();
  app.use(express.json());
  app.use('/api', createAuthRoutes(deps as any));

  const bootstrap = await request(app)
    .post('/api/auth/bootstrap')
    .send({ password: 'secret-123' });
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body.token, 'token-123');
  assert.equal(deps.config.auth.password, 'hash:secret-123');
  assert.equal(deps.config.auth.tokenSecret, 'generated-secret-generated-secret');

  const login = await request(app)
    .post('/api/auth/login')
    .send({ password: 'secret-123' });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body, { token: 'token-123' });

  const profileSave = await request(app)
    .post('/api/profile')
    .send({
      fullName: 'Anderson Souza',
      email: 'anderson@example.com',
      company: 'AndClaw',
      role: 'Founder',
      photoUrl: 'https://example.com/photo.png',
    });
  assert.equal(profileSave.status, 200);

  const profile = await request(app).get('/api/profile');
  assert.equal(profile.body.ok, true);
  assert.equal(profile.body.profile.fullName, 'Anderson Souza');
  assert.equal(profile.body.profile.email, 'anderson@example.com');
  assert.equal(profile.body.profile.photoUrl, 'https://example.com/photo.png');

  const preferencesSave = await request(app)
    .post('/api/preferences')
    .send({
      theme: 'dark',
      language: 'pt-BR',
      dateFormat: 'DD/MM/YYYY',
      notifyPush: true,
    });
  assert.equal(preferencesSave.status, 200);

  const preferences = await request(app).get('/api/preferences');
  assert.equal(preferences.body.ok, true);
  assert.equal(preferences.body.preferences.theme, 'dark');
  assert.equal(preferences.body.preferences.language, 'pt-BR');
  assert.equal(preferences.body.preferences.notifyPush, 'true');
});
