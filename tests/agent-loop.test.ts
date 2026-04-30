import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentControlState } from '@/contracts/trace';
import { AgentEvaluator } from '@/core/evaluation/AgentEvaluator';
import { config } from '@/config/env';
import { AgentLoop } from '@/core/AgentLoop';
import { ToolRegistry } from '@/core/ToolRegistry';
import { ContextBuilder } from '@/core/ContextBuilder';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { Tool } from '@/modules/tools/Tool';
import type { Skill } from '@/skills/SkillLoader';
import { z } from 'zod';
import { Pool } from 'pg';

class FakeProvider implements ILLMProvider {
  public calls = 0;

  async initialize(): Promise<void> {}

  async generateResponse() {
    this.calls += 1;
    if (this.calls === 1) {
      return {
        text: '',
        toolCalls: [{ name: 'test_echo', arguments: { message: 'hello' } }],
      };
    }
    return { text: 'final answer' };
  }
}

class EchoTool implements Tool {
  name = 'test_echo';
  description = 'Echo tool for agent flow testing.';
  category = 'cognitive' as const;
  parameters = { type: 'object' };
  inputSchema = z.object({
    message: z.string().min(1),
  });

  constructor(private onExecute: (message: string) => void) {}

  async execute(args: { message: string }): Promise<string> {
    this.onExecute(args.message);
    return `echo:${args.message}`;
  }
}

class SkillAwareProvider implements ILLMProvider {
  public calls = 0;
  public lastSystemPrompt = '';

  async initialize(): Promise<void> {}

  async generateResponse(systemPrompt: string) {
    this.calls += 1;
    this.lastSystemPrompt = systemPrompt;
    return { text: 'skill answer' };
  }
}

function mockCaptureInsert(): () => void {
  const originalQuery = Pool.prototype.query;
  Pool.prototype.query = (async () => ({
    rows: [{
      id: 1,
      content: 'mock capture',
      source: 'agent-loop',
      type: 'note',
      status: 'processed',
      metadata: {},
    }],
  })) as any;
  return () => {
    Pool.prototype.query = originalQuery;
  };
}

test('AgentLoop runs input -> memory -> tool execution -> persistence', async () => {
  const restoreQuery = mockCaptureInsert();
  const registry = new ToolRegistry();
  const calls: string[] = [];
  registry.registerTool(new EchoTool((message) => calls.push(`tool:${message}`)));

  const provider = new FakeProvider();
  const memoryManager = {
    buildSemanticContext: async (input: string) => {
      calls.push(`context:${input}`);
      return '[MEMÓRIA SEMÂNTICA]\n1. note\n[FIM DA MEMÓRIA SEMÂNTICA]';
    },
    persistTurn: async (userId: string, providerName: string, input: string, output: string) => {
      calls.push(`persist:${userId}:${providerName}:${input}:${output}`);
    },
  } as any;
  const profileRepo = {
    getAll: async () => [],
  } as any;

  const loop = new AgentLoop(
    'fake-provider',
    registry,
    undefined as any,
    undefined as any,
    memoryManager,
    {
      provider,
      profileRepo,
      contextBuilder: new ContextBuilder(),
    }
  );

  try {
    const result = await loop.run(
      'Base prompt',
      [{ role: 'user', content: 'previous turn' }],
      'plan the next step',
      { userId: 'user-1', memoryLimit: 2 }
    );

    assert.equal(result, 'final answer\n\n---\n*AndClaw OS: 🧠 Memória armazenada*');
    assert.deepEqual(calls, [
      'context:plan the next step',
      'tool:hello',
      'persist:user-1:fake-provider:plan the next step:final answer',
    ]);
    assert.equal(provider.calls, 2);
  } finally {
    restoreQuery();
  }
});

test('AgentLoop returns semantic cache hits without calling the provider', async () => {
  const restoreQuery = mockCaptureInsert();
  const registry = new ToolRegistry();
  const provider = new FakeProvider();
  const cacheService = {
    get: async () => ({
      id: 1,
      input: 'cached prompt',
      output: 'cached answer',
      created_at: new Date().toISOString(),
      distance: 0.02,
    }),
    set: async () => null,
  } as any;

  let semanticContextBuilt = false;
  let persisted = false;
  const memoryManager = {
    buildSemanticContext: async () => {
      semanticContextBuilt = true;
      return '';
    },
    persistTurn: async () => {
      persisted = true;
    },
  } as any;
  const profileRepo = {
    getAll: async () => [],
  } as any;

  const loop = new AgentLoop(
    'fake-provider',
    registry,
    undefined as any,
    undefined as any,
    memoryManager,
    {
      provider,
      profileRepo,
      contextBuilder: new ContextBuilder(),
      cacheService,
    }
  );

  try {
    const result = await loop.run(
      'Base prompt',
      [{ role: 'user', content: 'previous turn' }],
      'plan the next step',
      { userId: 'user-1', memoryLimit: 2, requestId: 'req-123' }
    );

    assert.equal(result, 'cached answer\n\n---\n*AndClaw OS: 🧠 Memória armazenada*');
    assert.equal(provider.calls, 0);
    assert.equal(semanticContextBuilt, false);
    assert.equal(persisted, true);
  } finally {
    restoreQuery();
  }
});

test('AgentLoop executes skill-oriented flows with deterministic skill selection', async () => {
  const restoreQuery = mockCaptureInsert();
  const registry = new ToolRegistry();
  const provider = new SkillAwareProvider();
  const skill: Skill = {
    metadata: {
      name: 'user-profiling',
      description: 'Identifica e memoriza informações.',
    },
    content: 'Aplique o protocolo de perfil do usuário.',
    folderName: 'user-profiling',
  };

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
      skillLoader: {
        fetchSkills: () => [skill],
      } as any,
    }
  );

  try {
    const result = await loop.run(
      'Base prompt',
      [],
      'atualize meu perfil com linguagem TypeScript',
      { userId: 'user-1', requestId: 'req-skill' }
    );

    assert.equal(provider.calls, 1);
    assert.match(provider.lastSystemPrompt, /Aplique o protocolo de perfil do usuário/);
    assert.equal(result, 'skill answer');
  } finally {
    restoreQuery();
  }
});

test('AgentLoop pause gate rejects with PauseTimeoutError after TTL expires', async () => {
  const registry = new ToolRegistry();
  const provider = new FakeProvider();
  const originalTimeout = config.llm.pauseTimeoutMs;
  config.llm.pauseTimeoutMs = 1;
  AgentControlState.pause('req-timeout');

  try {
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
      }
    );

    await assert.rejects(
      () => loop.run('Base prompt', [], 'blocked request', { userId: 'user-1', requestId: 'req-timeout' }),
      (error: unknown) => error instanceof Error && error.name === 'PauseTimeoutError'
    );
  } finally {
    AgentControlState.resume('req-timeout');
    config.llm.pauseTimeoutMs = originalTimeout;
  }
});

test('AgentLoop routeToCapture throws on persistence failure', async () => {
  const registry = new ToolRegistry();
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
      profileRepo: { getAll: async () => [] } as any,
      contextBuilder: new ContextBuilder(),
    }
  );

  const originalQuery = Pool.prototype.query;
  Pool.prototype.query = (async () => {
    throw new Error('forced persistence failure');
  }) as any;

  try {
    await assert.rejects(
      () => (loop as any).routeToCapture('hello', { type: 'note', confidence: 0.9 }, 'req-failure'),
      /forced persistence failure/
    );
  } finally {
    Pool.prototype.query = originalQuery;
  }
});

test('AgentLoop totalIterations equals the number of loop turns executed', async () => {
  const restoreQuery = mockCaptureInsert();
  const registry = new ToolRegistry();
  const calls: string[] = [];
  registry.registerTool(new EchoTool((message) => calls.push(`tool:${message}`)));

  const provider = new FakeProvider();
  const observed: number[] = [];
  const originalEvaluateRun = AgentEvaluator.evaluateRun;
  AgentEvaluator.evaluateRun = ((metrics: { totalIterations: number }) => {
    observed.push(metrics.totalIterations);
  }) as any;

  try {
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
      }
    );

    await loop.run('Base prompt', [], 'plan the next step', { userId: 'user-1' });
  } finally {
    AgentEvaluator.evaluateRun = originalEvaluateRun;
    restoreQuery();
  }

  assert.deepEqual(observed, [2]);
});
