import assert from 'node:assert/strict';
import test from 'node:test';
import { EmbeddingService } from '@/core/embedding/EmbeddingService';
import { MemoryManager } from '@/memory/MemoryManager';

test('EmbeddingService generates deterministic normalized fallback embeddings', async () => {
  const service = new EmbeddingService({ provider: 'local' });
  const first = await service.generateEmbedding('AndClaw memory layer');
  const second = await service.generateEmbedding('AndClaw memory layer');

  assert.equal(first.length, 1536);
  assert.equal(second.length, 1536);
  assert.deepEqual(first, second);
  const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
  assert.ok(magnitude > 0.99 && magnitude < 1.01);
});

test('MemoryManager builds semantic context from retrieved memories', async () => {
  const fakeEmbeddingService = {
    generateEmbedding: async (text: string) => [text.length, 0, 0, 0],
  };

  const fakeMemoryService = {
    searchByText: async () => ([
      {
        type: 'meeting',
        source_type: 'transcript',
        content: 'Decisão de produto '.repeat(60),
      },
      {
        type: 'knowledge',
        source_type: 'note',
        content: 'Priorizar onboarding e memória persistente.',
      },
    ]),
    save: async () => null,
    search: async () => [],
  };

  const memoryManager = new MemoryManager(fakeEmbeddingService as any, fakeMemoryService as any);
  const context = await memoryManager.buildSemanticContext('memória de reunião');

  assert.match(context, /\[MEMÓRIA SEMÂNTICA\]/);
  assert.match(context, /1\. meeting \(transcript\)/);
  assert.match(context, /2\. knowledge \(note\)/);
  assert.match(context, /\[FIM DA MEMÓRIA SEMÂNTICA\]/);
  assert.match(context, /\.\.\./);
});
