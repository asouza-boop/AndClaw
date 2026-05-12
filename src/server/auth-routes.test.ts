import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

process.env.OAUTH_ENCRYPTION_KEY ||= '0'.repeat(64);

test('GET /api/auth/google is reachable without JWT and redirects to Google', async () => {
  const { config } = await import('@/config/env');
  const { createApp } = await import('@/server/app');
  config.auth.password = '';
  config.auth.tokenSecret = '';
  config.google.oauthClientId = 'google-client-id';
  config.google.oauthClientSecret = 'google-client-secret';
  config.google.oauthRedirectUri = 'http://localhost:3000/api/auth/google/callback';

  const res = await request(createApp()).get('/api/auth/google?state=state-123');

  assert.equal(res.status, 302);
  assert.notEqual(res.status, 401);
  assert.match(res.headers.location, /^https:\/\/accounts\.google\.com\/o\/oauth2/);
});

test('GET /api/auth/google passes frontend state through to Google OAuth', async () => {
  const { config } = await import('@/config/env');
  const { createApp } = await import('@/server/app');
  config.auth.password = '';
  config.auth.tokenSecret = '';
  config.google.oauthClientId = 'google-client-id';
  config.google.oauthClientSecret = 'google-client-secret';
  config.google.oauthRedirectUri = 'http://localhost:3000/api/auth/google/callback';

  const res = await request(createApp()).get('/api/auth/google?state=expected-state');
  const location = new URL(res.headers.location);

  assert.equal(location.searchParams.get('state'), 'expected-state');
});

test('GET /api/auth/google/callback without code redirects to frontend login failure', async () => {
  const { config } = await import('@/config/env');
  const { createApp } = await import('@/server/app');
  config.auth.password = '';
  config.auth.tokenSecret = '';
  config.server.frontendUrl = 'https://frontend.example';
  config.google.oauthClientId = 'google-client-id';
  config.google.oauthClientSecret = 'google-client-secret';
  config.google.oauthRedirectUri = 'http://localhost:3000/api/auth/google/callback';

  const res = await request(createApp()).get('/api/auth/google/callback?state=state-123');

  assert.equal(res.status, 302);
  assert.equal(res.headers.location, 'https://frontend.example/login?error=auth_failed');
});

test('GET /api/auth/google/callback uses allowed returnTo origin from OAuth state', async () => {
  const { config } = await import('@/config/env');
  const { createApp } = await import('@/server/app');
  config.auth.password = '';
  config.auth.tokenSecret = '';
  config.server.frontendUrl = 'https://and-claw.vercel.app';
  config.server.allowedOrigin = 'https://preview.example';
  config.google.oauthClientId = 'google-client-id';
  config.google.oauthClientSecret = 'google-client-secret';
  config.google.oauthRedirectUri = 'http://localhost:3000/api/auth/google/callback';
  const state = `nonce.${Buffer.from(JSON.stringify({ returnTo: 'https://preview.example' })).toString('base64')}`;

  const res = await request(createApp()).get(`/api/auth/google/callback?state=${encodeURIComponent(state)}`);

  assert.equal(res.status, 302);
  assert.equal(res.headers.location, 'https://preview.example/login?error=auth_failed');
});

test('GET /api/auth/google/callback ignores unallowed returnTo origin from OAuth state', async () => {
  const { config } = await import('@/config/env');
  const { createApp } = await import('@/server/app');
  config.auth.password = '';
  config.auth.tokenSecret = '';
  config.server.frontendUrl = 'https://and-claw.vercel.app';
  config.server.allowedOrigin = 'https://preview.example';
  config.google.oauthClientId = 'google-client-id';
  config.google.oauthClientSecret = 'google-client-secret';
  config.google.oauthRedirectUri = 'http://localhost:3000/api/auth/google/callback';
  const state = `nonce.${Buffer.from(JSON.stringify({ returnTo: 'https://evil.example' })).toString('base64')}`;

  const res = await request(createApp()).get(`/api/auth/google/callback?state=${encodeURIComponent(state)}`);

  assert.equal(res.status, 302);
  assert.equal(res.headers.location, 'https://and-claw.vercel.app/login?error=auth_failed');
});
