import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AgentLoop } from '@/core/AgentLoop';
import { ToolRegistry } from '@/core/ToolRegistry';
import { ContextBuilder } from '@/core/ContextBuilder';
import { IntentDetector } from '@/core/planner/IntentDetector';
import { ActionPlanner } from '@/core/planner/ActionPlanner';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { Tool } from '@/modules/tools/Tool';
import type { Skill } from '@/skills/SkillLoader';
import { z } from 'zod';

class StaticProvider implements ILLMProvider {
  public calls = 0;

  async initialize(): Promise<void> {}

  async generateResponse() {
    this.calls += 1;
    return { text: 'fallback answer' };
  }
}

class ThrowingWriteTool implements Tool {
  name = 'write_file';
  description = 'Throwing write tool for fallback tests.';
  category = 'system' as const;
  parameters = { type: 'object' };
  inputSchema = z.object({
    path: z.string().min(1),
    content: z.string().min(1),
  });

  async execute(): Promise<string> {
    throw new Error('boom');
  }
}

test('IntentDetector resolves deterministic action intents', () => {
  const detector = new IntentDetector();

  const profileIntent = detector.detect('atualize meu perfil com linguagem TypeScript');
  assert.equal(profileIntent?.name, 'profile.upsert');
  assert.equal(profileIntent?.slots.key, 'linguagem_favorita');
  assert.ok(profileIntent?.slots.value);

  const genericPreference = detector.detect('atualize meu perfil com preferência café');
  assert.equal(genericPreference?.name, 'profile.upsert');
  assert.equal(genericPreference?.slots.key, 'preferencia');

  const ambiguous = detector.detect('talvez depois a gente veja isso');
  assert.equal(ambiguous, null);
});

test('ActionPlanner keeps plans linear and bounded', () => {
  const detector = new IntentDetector();
  const planner = new ActionPlanner();
  const registry = new ToolRegistry();
  const skills: Skill[] = [
    {
      metadata: {
        name: 'user-profiling',
        description: 'Perfil do usuário.',
      },
      content: 'skill content',
      folderName: 'user-profiling',
    },
  ];

  const intent = detector.detect('procure o arquivo source.ts e leia seu conteúdo');
  assert.ok(intent);

  const plan = planner.plan(intent!, registry.getAllTools(), skills);
  assert.ok(plan);
  assert.equal(plan!.type, 'tool');
  assert.ok(plan!.steps.length <= 2);
  assert.deepEqual(plan!.steps.map((step) => step.tool), ['glob', 'read_file']);
  assert.equal(plan!.steps[0].outputKey, 'matches');
  assert.equal(plan!.steps[1].inputKey, 'matches');
});

test('ActionPlanner prefers skills when available', () => {
  const detector = new IntentDetector();
  const planner = new ActionPlanner();
  const registry = new ToolRegistry();
  const skills: Skill[] = [
    {
      metadata: {
        name: 'user-profiling',
        description: 'Perfil do usuário.',
      },
      content: 'skill content',
      folderName: 'user-profiling',
    },
  ];

  const intent = detector.detect('atualize meu perfil com linguagem TypeScript');
  assert.ok(intent);

  const plan = planner.plan(intent!, registry.getAllTools(), skills);
  assert.ok(plan);
  assert.equal(plan!.type, 'skill');
  if (plan!.type === 'skill') {
    assert.equal(plan!.skill, 'user-profiling');
  }
});

test('AgentLoop executes a planned read action without calling the LLM', async () => {
  const registry = new ToolRegistry();
  const fileName = `action-plan-read-${crypto.randomUUID()}.txt`;
  const absolute = path.join(process.cwd(), fileName);
  fs.writeFileSync(absolute, 'conteudo planejado', 'utf-8');

  const provider = new StaticProvider();
  const loop = new AgentLoop(
    'fake-provider',
    registry,
    undefined as any,
    undefined as any,
    {
      buildSemanticContext: async () => '',
      persistTurn: async () => undefined,
    } as any,
    {
      provider,
      profileRepo: { getAll: async () => [] } as any,
      contextBuilder: new ContextBuilder(),
      intentDetector: new IntentDetector(),
      actionPlanner: new ActionPlanner(),
    }
  );

  try {
    const output = await loop.run(
      'Base prompt',
      [],
      `leia o arquivo ${fileName}`,
      { userId: 'user-1', requestId: 'req-read' }
    );

    assert.equal(provider.calls, 0);
    assert.equal(output, 'conteudo planejado');
  } finally {
    fs.rmSync(absolute, { force: true });
  }
});

test('AgentLoop supports two-step plans by passing tool output between steps', async () => {
  const registry = new ToolRegistry();
  const fileName = `action-plan-search-${crypto.randomUUID()}.txt`;
  const absolute = path.join(process.cwd(), fileName);
  fs.writeFileSync(absolute, 'conteudo de busca em duas etapas', 'utf-8');

  const provider = new StaticProvider();
  const loop = new AgentLoop(
    'fake-provider',
    registry,
    undefined as any,
    undefined as any,
    {
      buildSemanticContext: async () => '',
      persistTurn: async () => undefined,
    } as any,
    {
      provider,
      profileRepo: { getAll: async () => [] } as any,
      contextBuilder: new ContextBuilder(),
      intentDetector: new IntentDetector(),
      actionPlanner: new ActionPlanner(),
    }
  );

  try {
    const output = await loop.run(
      'Base prompt',
      [],
      `procure o arquivo ${fileName} e leia seu conteúdo`,
      { userId: 'user-1', requestId: 'req-search' }
    );

    assert.equal(provider.calls, 0);
    assert.match(output, /conteudo de busca em duas etapas/);
  } finally {
    fs.rmSync(absolute, { force: true });
  }
});

test('AgentLoop falls back to LLM when a planned tool fails', async () => {
  const registry = new ToolRegistry();
  registry.registerTool(new ThrowingWriteTool());

  const provider = new StaticProvider();
  const loop = new AgentLoop(
    'fake-provider',
    registry,
    undefined as any,
    undefined as any,
    {
      buildSemanticContext: async () => '',
      persistTurn: async () => undefined,
    } as any,
    {
      provider,
      profileRepo: { getAll: async () => [] } as any,
      contextBuilder: new ContextBuilder(),
      intentDetector: new IntentDetector(),
      actionPlanner: new ActionPlanner(),
    }
  );

  const output = await loop.run(
    'Base prompt',
    [],
    'escreva arquivo notes.txt com conteudo fallback after failure',
    { userId: 'user-1', requestId: 'req-fallback' }
  );

  assert.equal(provider.calls, 1);
  assert.equal(output, 'fallback answer');
});
