import assert from 'node:assert/strict';
import test from 'node:test';
import { ToolExecutor } from '@/core/agent/ToolExecutor';

test('ToolExecutor executes a tool-free LLM flow and persists results', async () => {
  const calls: string[] = [];
  const executor = new ToolExecutor({
    providerName: 'mock-provider',
    registry: {
      getTool: () => null,
      getAllTools: () => [],
    } as any,
    maxIterations: 3,
    memoryManager: {
      buildSemanticContext: async () => '',
      persistTurn: async (userId: string, providerName: string, input: string, output: string) => {
        calls.push(`persist:${userId}:${providerName}:${input}:${output}`);
      },
    } as any,
    contextBuilder: {
      build: ({ systemPrompt }) => systemPrompt,
    } as any,
    embeddingService: {
      generateEmbedding: async () => [0.1, 0.2],
    } as any,
    cacheService: {
      get: async () => null,
      set: async (input: string, embedding: number[], output: string) => {
        calls.push(`cache:${input}:${embedding.length}:${output}`);
        return null;
      },
    } as any,
    plannerService: {
      validate: () => ({ isValid: true, reason: '' }),
    } as any,
    digestService: {
      process: async (input: string, output: string) => {
        calls.push(`digest:${input}:${output}`);
      },
    } as any,
    getProvider: () => ({
      generateResponse: async () => ({ text: 'hello from executor' }),
      initialize: async () => undefined,
    }) as any,
    buildInitialMessages: () => [],
    buildCacheInput: () => 'cache-input',
    composeSkillSystemPrompt: (systemPrompt) => systemPrompt,
    normalizeProfileEntries: (profile) => profile as any,
    resolvePlannedToolInput: () => null,
    normalizeToolArguments: (args) => args as Record<string, unknown>,
    handleTraceStep: () => undefined,
    checkpoint: async () => undefined,
  });

  const result = await executor.executeLLMFlow({
    provider: {
      generateResponse: async () => ({ text: 'hello from executor' }),
      initialize: async () => undefined,
    } as any,
    composedSystemPrompt: 'Base prompt',
    availableTools: [],
    userId: 'user-1',
    parsed: {
      systemPrompt: 'Base prompt',
      history: [],
      userInput: 'remember this',
      options: {},
    } as any,
    requestId: 'req-exec',
    startedAt: Date.now(),
    cacheContext: {
      cacheInput: 'cache-input',
      cacheEmbedding: [0.1, 0.2],
    },
    trace: { version: 'v1', steps: [] } as any,
    addStep: () => undefined,
    checkpoint: async () => undefined,
  });

  assert.equal(result, 'hello from executor');
  assert.deepEqual(calls, [
    'cache:cache-input:2:hello from executor',
    'persist:user-1:mock-provider:remember this:hello from executor',
    'digest:remember this:hello from executor',
  ]);
});
