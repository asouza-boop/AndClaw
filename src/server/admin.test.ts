import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { bootstrapGuard } from '@/server/admin';
import { authMiddleware, issueToken, sseAuthMiddleware } from '@/server/auth';
import { config } from '@/config/env';

test('bootstrapGuard allows JWT auth when token secret exists without password', async () => {
  const originalAuth = { ...config.auth };
  config.auth.password = '';
  config.auth.tokenSecret = 'generated-secret-generated-secret';
  const token = issueToken('google-user@example.com');

  const app = express();
  app.get('/api/protected', (req, res, next) => {
    bootstrapGuard(req, res, () => authMiddleware(req, res, next));
  }, (req, res) => {
    res.json({ ok: true, user: (req as any).user.sub });
  });

  try {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, user: 'google-user@example.com' });
  } finally {
    config.auth.password = originalAuth.password;
    config.auth.tokenSecret = originalAuth.tokenSecret;
  }
});

test('bootstrapGuard still blocks when token secret is missing', async () => {
  const originalAuth = { ...config.auth };
  config.auth.password = '';
  config.auth.tokenSecret = '';

  const app = express();
  app.get('/api/protected', (req, res, next) => {
    bootstrapGuard(req, res, next);
  }, (_req, res) => {
    res.json({ ok: true });
  });

  try {
    const res = await request(app).get('/api/protected');

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'bootstrap_required');
  } finally {
    config.auth.password = originalAuth.password;
    config.auth.tokenSecret = originalAuth.tokenSecret;
  }
});

test('authMiddleware rejects query token on normal routes', async () => {
  const originalAuth = { ...config.auth };
  config.auth.password = '';
  config.auth.tokenSecret = 'generated-secret-generated-secret';
  const token = issueToken('google-user@example.com');

  const app = express();
  app.get('/api/protected', (req, res, next) => {
    authMiddleware(req, res, next);
  }, (_req, res) => {
    res.json({ ok: true });
  });

  try {
    const res = await request(app)
      .get('/api/protected')
      .query({ token });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'unauthorized');
  } finally {
    config.auth.password = originalAuth.password;
    config.auth.tokenSecret = originalAuth.tokenSecret;
  }
});

test('sseAuthMiddleware allows query token for SSE routes', async () => {
  const originalAuth = { ...config.auth };
  config.auth.password = '';
  config.auth.tokenSecret = 'generated-secret-generated-secret';
  const token = issueToken('google-user@example.com');

  const app = express();
  app.get('/api/events/digest', (req, res, next) => {
    sseAuthMiddleware(req, res, next);
  }, (_req, res) => {
    res.json({ ok: true, user: ( _req as any).user?.sub });
  });

  try {
    const res = await request(app)
      .get('/api/events/digest')
      .query({ token });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, user: 'google-user@example.com' });
  } finally {
    config.auth.password = originalAuth.password;
    config.auth.tokenSecret = originalAuth.tokenSecret;
  }
});
