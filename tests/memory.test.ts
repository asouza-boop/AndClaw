require('tsx/cjs');
const express = require('express');
const request = require('supertest');
const assert = require('node:assert/strict');
const test = require('node:test');
const { EmbeddingService, EmbeddingError  } = require('@/core/memory/EmbeddingService');
const { MemoryService  } = require('@/core/memory/MemoryService');
const { MemoryDigestionService  } = require('@/core/agent/MemoryDigestionService');
const { config  } = require('@/config/env');




test('EmbeddingService throws EmbeddingError when apiKey is empty', async () => {
  const service = new EmbeddingService({ apiKey: '' });
  await assert.rejects(
    async () => service.generateEmbedding('test text'),
    (err: Error) => {
      assert.equal(err.name, 'EmbeddingError');
      return true;
    }
  );
});

test('EmbeddingService.generateBatch returns zero vector on single item failure', async () => {
  const service = new EmbeddingService({ apiKey: 'fake' });
  // Stub fetch to reject for 'bad text'
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    const body = JSON.parse((init?.body as string) || '{}');
    if (body.input === 'bad text') {
      throw new Error('Network error');
    }
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1536).fill(0.1) }] })
    } as any;
  };

  try {
    const results = await service.generateBatch(['good text', 'bad text']);
    assert.equal(results.length, 2);
    // 'bad text' should fallback to 0 array
    assert.deepEqual(results[1], Array(1536).fill(0));
  } finally {
    global.fetch = originalFetch;
  }
});

test('MemoryService.save returns null when config.db.url is empty', async () => {
  const originalUrl = config.db.url;
  config.db.url = '';
  
  try {
    const service = new MemoryService();
    const result = await service.save('test', Array(1536).fill(0.1), {});
    assert.equal(result, null);
  } finally {
    config.db.url = originalUrl;
  }
});

test('MemoryDigestionService.isMemorable returns false for short generic text', () => {
  const isMemorable = MemoryDigestionService.isMemorable('ok', 'sure, I can help you with that');
  assert.equal(isMemorable, false);
});

test('MemoryDigestionService.isMemorable returns true for memorable text', () => {
  const isMemorable = MemoryDigestionService.isMemorable('lembre que usamos Neon para o banco', 'entendido');
  assert.equal(isMemorable, true);
});

test('memory-routes POST /memory returns 201', async () => {
  const app = express();
  app.use(express.json());
  
  // Mock deps for router
  const mockDeps = {
    query: async () => [{ id: 1, type: 'note', content: 'test' }]
  };
  
  // Create router instance with mock query
  // Wait, memory-routes uses a factory function but doesn't expose it correctly if I just import the default.
  // Actually, createMemoryRoutes is exported as well!
  // I imported it as createMemoryRoutes above (wait, is it exported? Yes, let's check).
  // In memory-routes.ts: `export function createMemoryRoutes(overrides: Partial<MemoryRouteDeps> = {})`
  const { createMemoryRoutes } = require('@/server/memory-routes');
  const router = createMemoryRoutes(mockDeps as any);
  app.use('/', router);

  // Stub EmbeddingService.prototype.generateEmbedding
  const originalGenerate = EmbeddingService.prototype.generateEmbedding;
  EmbeddingService.prototype.generateEmbedding = async () => Array(1536).fill(0.1);

  try {
    const response = await request(app)
      .post('/memory')
      .send({ type: 'note', content: 'test knowledge' });

    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
  } finally {
    EmbeddingService.prototype.generateEmbedding = originalGenerate;
  }
});
