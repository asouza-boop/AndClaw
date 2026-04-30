import assert from 'node:assert/strict';
import test from 'node:test';
import { PlannerService } from '@/core/agent/PlannerService';

test('PlannerService delegates plan and validate responsibilities', () => {
  const calls: string[] = [];
  const service = new PlannerService({
    actionPlanner: {
      plan: (intent, tools, skills, variant) => {
        calls.push(`plan:${intent.name}:${tools.length}:${skills.length}:${variant}`);
        return { type: 'tool', intent: intent.name, steps: [] } as any;
      },
    } as any,
    validatePlan: (toolCalls) => {
      calls.push(`validate:${toolCalls.length}`);
      return { isValid: true, reason: '' } as any;
    },
  });

  const plan = service.plan(
    { name: 'profile.upsert', confidence: 0.9, slots: {}, requestId: 'req-plan' } as any,
    [{ name: 'update_user_profile' } as any],
    [],
    'B',
  );

  const validation = service.validate([{ name: 'mock-tool' }]);

  assert.deepEqual(plan, { type: 'tool', intent: 'profile.upsert', steps: [] });
  assert.deepEqual(validation, { isValid: true, reason: '' });
  assert.deepEqual(calls, [
    'plan:profile.upsert:1:0:B',
    'validate:1',
  ]);
});
