import assert from 'node:assert/strict';
import test from 'node:test';
import { CacheService } from '@/core/agent/CacheService';

test('CacheService forwards get and set calls to the semantic cache implementation', async () => {
  const calls: string[] = [];
  const cache = new CacheService({
    get: async (embedding, context) => {
      calls.push(`get:${embedding.length}:${context.requestId}`);
      return { input: 'in', output: 'out' };
    },
    set: async (input, embedding, output, context) => {
      calls.push(`set:${input}:${embedding.length}:${output}:${context.requestId}`);
      return { input, output };
    },
  } as any);

  const hit = await cache.get([0.1, 0.2, 0.3], { requestId: 'req-cache' });
  const saved = await cache.set('prompt', [0.4], 'answer', { requestId: 'req-save' });

  assert.deepEqual(hit, { input: 'in', output: 'out' });
  assert.deepEqual(saved, { input: 'prompt', output: 'answer' });
  assert.deepEqual(calls, [
    'get:3:req-cache',
    'set:prompt:1:answer:req-save',
  ]);
});
