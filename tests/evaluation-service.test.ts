import assert from 'node:assert/strict';
import test from 'node:test';
import { EvaluationService } from '@/core/agent/EvaluationService';
import { FeedbackEntry } from '@/core/learning/OptimizationEngine';

test('EvaluationService delegates evaluation and background telemetry', () => {
  const calls: string[] = [];
  const feedback: FeedbackEntry = {
    requestId: 'req-1',
    success: true,
    latencyMs: 123,
    skillId: 'skill-alpha',
    toolsUsed: ['tool-a'],
    executionPath: 'llm-flow',
    errorCount: 0,
    timestamp: new Date().toISOString(),
  };

  const service = new EvaluationService({
    evaluateRun: (metrics, variant) => {
      calls.push(`evaluate:${variant}:${metrics.totalIterations}:${metrics.isFallback ? 'fallback' : 'direct'}`);
    },
    collect: (entry) => {
      calls.push(`collect:${entry.requestId}:${entry.executionPath}`);
    },
    processFeedback: (entry) => {
      calls.push(`process:${entry.skillId}:${entry.success}`);
    },
  });

  service.recordRun(
    {
      success: true,
      latencyMs: 123,
      toolUsageCount: 2,
      errorCount: 0,
      totalIterations: 3,
    },
    'B',
    feedback,
    {
      backgroundSafe: false,
      processOptimization: false,
    }
  );

  service.recordRun(
    {
      success: false,
      latencyMs: 456,
      toolUsageCount: 0,
      errorCount: 1,
      totalIterations: 1,
      isFallback: true,
    },
    'A',
    feedback
  );

  assert.deepEqual(calls, [
    'evaluate:B:3:direct',
    'collect:req-1:llm-flow',
    'evaluate:A:1:fallback',
    'collect:req-1:llm-flow',
    'process:skill-alpha:true',
  ]);
});
