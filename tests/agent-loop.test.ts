import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentLoop } from '@/core/AgentLoop';
import { ToolRegistry } from '@/core/ToolRegistry';
import { ContextBuilder } from '@/core/ContextBuilder';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { Tool } from '@/modules/tools/Tool';
import { z } from 'zod';

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

test('AgentLoop runs input -> memory -> tool execution -> persistence', async () => {
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

  const result = await loop.run(
    'Base prompt',
    [{ role: 'user', content: 'previous turn' }],
    'plan the next step',
    { userId: 'user-1', memoryLimit: 2 }
  );

  assert.equal(result, 'final answer');
  assert.deepEqual(calls, [
    'context:plan the next step',
    'tool:hello',
    'persist:user-1:fake-provider:plan the next step:final answer',
  ]);
  assert.equal(provider.calls, 2);
});

test('AgentLoop returns semantic cache hits without calling the provider', async () => {
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

  const result = await loop.run(
    'Base prompt',
    [{ role: 'user', content: 'previous turn' }],
    'plan the next step',
    { userId: 'user-1', memoryLimit: 2, requestId: 'req-123' }
  );

  assert.equal(result, 'cached answer');
  assert.equal(provider.calls, 0);
  assert.equal(semanticContextBuilt, false);
  assert.equal(persisted, true);
});
