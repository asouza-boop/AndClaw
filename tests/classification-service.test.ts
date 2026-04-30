import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassificationService } from '@/core/agent/ClassificationService';

test('ClassificationService applies the same routing heuristics as AgentLoop', () => {
  const service = new ClassificationService();

  assert.deepEqual(service.classifyInput('check https://example.com'), {
    type: 'link',
    confidence: 1,
  });

  assert.deepEqual(service.classifyInput('preciso marcar uma reunião amanhã'), {
    type: 'meeting',
    confidence: 0.95,
  });

  assert.deepEqual(service.classifyInput('fazer um relatório do trimestre'), {
    type: 'task',
    confidence: 0.9,
  });

  assert.deepEqual(service.classifyInput('vamos iniciar plano de projeto novo'), {
    type: 'project',
    confidence: 0.85,
  });

  assert.deepEqual(service.classifyInput('texto curto sem pistas'), {
    type: 'note',
    confidence: 0.7,
  });
});
