import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import request from 'supertest';
import { metrics } from '@/infra/metrics/MetricsService';
import { createApp } from '@/server/app';
import { config as globalConfig } from '@/config/env';
import { issueToken } from '@/server/auth';

beforeEach(() => {
  metrics.reset();
});

test('metrics service tracks counters and observations', async () => {
  metrics.increment('cache.hit');
  metrics.increment('cache.hit');
  metrics.observe('agent.latency', 10);
  metrics.observe('agent.latency', 30);

  const snapshot = metrics.getMetrics();

  assert.equal(snapshot['cache.hit']?.value, 2);
  assert.equal(snapshot['agent.latency']?.count, 2);
  assert.equal(snapshot['agent.latency']?.sum, 40);
  assert.equal(snapshot['agent.latency']?.average, 20);
  assert.equal(snapshot['agent.latency']?.min, 10);
  assert.equal(snapshot['agent.latency']?.max, 30);
  assert.equal(snapshot['agent.latency']?.last, 30);
});

test('admin metrics endpoint is protected and returns snapshot', async () => {
  const originalAuth = { ...globalConfig.auth };
  const originalLlm = { ...globalConfig.llm };
  const originalDb = { ...globalConfig.db };

  globalConfig.auth.password = 'hash:secret-123';
  globalConfig.auth.tokenSecret = 'generated-secret-generated-secret';
  globalConfig.llm.geminiKey = 'gemini-key';
  globalConfig.db.url = '';

  metrics.reset();
  metrics.increment('cache.hit');
  metrics.observe('agent.latency', 12);

  try {
    const app = createApp();

    const unauthorized = await request(app).get('/admin/metrics');
    assert.equal(unauthorized.status, 401);

    const token = issueToken('andclaw-user');
    const authorized = await request(app)
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.ok, true);
    assert.equal(authorized.body.metrics['cache.hit'].value, 1);
    assert.equal(authorized.body.metrics['agent.latency'].count, 1);
    assert.equal(authorized.body.metrics['agent.latency'].average, 12);
    assert.ok(authorized.headers['x-request-id']);
  } finally {
    globalConfig.auth.password = originalAuth.password;
    globalConfig.auth.tokenSecret = originalAuth.tokenSecret;
    globalConfig.llm.geminiKey = originalLlm.geminiKey;
    globalConfig.db.url = originalDb.url;
  }
});
