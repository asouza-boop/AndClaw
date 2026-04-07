import assert from 'node:assert/strict';
import test from 'node:test';
import { config as globalConfig } from '@/config/env';
import { SemanticCacheService } from '@/core/cache/SemanticCacheService';

test('SemanticCacheService returns cached output when similar and misses when distant', async () => {
  const originalDbUrl = globalConfig.db.url;
  globalConfig.db.url = 'postgres://integration-test';

  try {
    const hitService = new SemanticCacheService({
      similarityThreshold: 0.1,
      query: async () => [{
        id: 1,
        input: 'hello',
        output: 'cached-output',
        distance: 0.05,
        created_at: new Date().toISOString(),
      }] as any,
    });

    const hit = await hitService.get([0.1, 0.2, 0.3]);
    assert.equal(hit?.output, 'cached-output');

    const missService = new SemanticCacheService({
      similarityThreshold: 0.1,
      query: async () => [{
        id: 1,
        input: 'hello',
        output: 'cached-output',
        distance: 0.45,
        created_at: new Date().toISOString(),
      }] as any,
    });

    const miss = await missService.get([0.1, 0.2, 0.3]);
    assert.equal(miss, null);
  } finally {
    globalConfig.db.url = originalDbUrl;
  }
});
