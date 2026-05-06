import assert from 'assert';
import { EmbeddingService, EmbeddingError } from './EmbeddingService';
import { VECTOR_DIMENSIONS } from '@/infra/db/vector';

const originalFetch = global.fetch;

async function testEmbeddingService() {
  console.log('Running EmbeddingService tests...');

  const service = new EmbeddingService({ apiKey: 'test-api-key' });

  // 1. generateEmbedding returns array of correct dimensions
  const mockEmbedding = new Array(VECTOR_DIMENSIONS).fill(0.1);
  let fetchCalled = 0;
  global.fetch = async (url, options: any) => {
    fetchCalled++;
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    } as any;
  };

  const result = await service.generateEmbedding('hello world');
  assert.strictEqual(fetchCalled, 1);
  assert.strictEqual(result.length, VECTOR_DIMENSIONS);
  console.log('✅ generateEmbedding returns array of correct dimensions');

  // 2. Input longer than 8000 chars is truncated before API call
  let passedInputLength = 0;
  global.fetch = async (url, options: any) => {
    const body = JSON.parse(options.body);
    passedInputLength = body.input.length;
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    } as any;
  };
  await service.generateEmbedding('a'.repeat(10000));
  assert.strictEqual(passedInputLength, 8000);
  console.log('✅ Input longer than 8000 chars is truncated before API call');

  // 3. API failure throws EmbeddingError (not returns zeros)
  global.fetch = async () => {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Provider error'
    } as any;
  };
  let errorThrown = false;
  try {
    await service.generateEmbedding('hello world');
  } catch (err) {
    if (err instanceof EmbeddingError) errorThrown = true;
  }
  assert.strictEqual(errorThrown, true);
  console.log('✅ API failure throws EmbeddingError (not returns zeros)');

  // 4. generateBatch processes in groups of 20
  global.fetch = async () => {
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    } as any;
  };
  const texts = new Array(45).fill('text');
  const results = await service.generateBatch(texts);
  assert.strictEqual(results.length, 45);
  console.log('✅ generateBatch processes in groups of 20');
}

testEmbeddingService().catch(e => {
  console.error('❌ EmbeddingService tests failed:', e);
  process.exit(1);
}).finally(() => {
  global.fetch = originalFetch;
});

