import assert from 'node:assert/strict';
import test from 'node:test';
import { DigestService } from '@/core/agent/DigestService';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('DigestService only digests memorable turns and records memory asynchronously', async () => {
  const calls: string[] = [];
  const service = new DigestService({
    isMemorable: (input, output) => {
      calls.push(`check:${input}:${output}`);
      return input.includes('mem');
    },
    digest: async (input, output) => {
      calls.push(`digest:${input}:${output}`);
      return 'fato permanente';
    },
    addSemanticMemory: async (fact, metadata) => {
      calls.push(`memory:${fact}:${metadata.source_id}:${metadata.userId}`);
    },
    logger: {
      info: (event: string) => calls.push(`info:${event}`),
      error: (event: string) => calls.push(`error:${event}`),
    },
  });

  await service.process('ignore this', 'plain reply', {} as any, {
    requestId: 'req-skip',
    userId: 'user-1',
  });

  await service.process('memorable input', 'assistant response', {} as any, {
    requestId: 'req-digest',
    userId: 'user-1',
  });

  await flush();
  await flush();

  assert.deepEqual(calls, [
    'check:ignore this:plain reply',
    'check:memorable input:assistant response',
    'digest:memorable input:assistant response',
    'memory:fato permanente:req-digest:user-1',
    'info:memory.digestion.completed',
  ]);
});
