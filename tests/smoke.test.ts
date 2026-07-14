import assert from 'node:assert/strict';
import test from 'node:test';
import { EmbeddingService } from '@/core/memory/EmbeddingService';
import { MemoryManager } from '@/memory/MemoryManager';


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
