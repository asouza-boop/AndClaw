import { ToolExecutor } from './ToolExecutor';
import { EvaluationService } from './EvaluationService';
import assert from 'assert';

async function testToolExecutor() {
  console.log('Running ToolExecutor tests...');

  // Mock Dependencies
  const mockRegistry = {
    getTool: (name: string) => {
      if (name === 'unknown') return null;
      return {
        name,
        inputSchema: { parse: (args: any) => args },
        execute: async (args: any) => {
          mockExecutionCount++;
          if (args.failTransient) {
            throw new Error("ETIMEDOUT: timeout reached");
          }
          if (args.failFatal) {
            throw new Error("401 Unauthorized");
          }
          if (args.blocked) {
            return "forbidden content detected";
          }
          return "Success result";
        }
      };
    },
    getAllTools: () => []
  };

  const evaluationService = new EvaluationService();

  const mockDeps = {
    registry: mockRegistry,
    evaluationService,
    maxIterations: 1,
    normalizeToolArguments: (args: any) => args,
    // Add other missing deps as needed for executeLLMFlow
    getProvider: () => ({}),
    buildInitialMessages: () => [],
  } as any;

  const executor = new ToolExecutor(mockDeps);

  // We need to test the logic. Since executeLLMFlow is hard to call without full context,
  // we'll test the helper methods and simulate the loop logic if possible, 
  // or just use a minimal executeLLMFlow call if we can mock the LLMClient response.

  console.log('Checking isTransientError classification...');
  const isTransient = (executor as any).isTransientError.bind(executor);
  assert.strictEqual(isTransient(new Error("ETIMEDOUT")), true, "ETIMEDOUT should be transient");
  assert.strictEqual(isTransient(new Error("429 Rate Limit")), true, "429 should be transient");
  assert.strictEqual(isTransient(new Error("401 Unauthorized")), false, "401 should NOT be transient");
  assert.strictEqual(isTransient(new Error("Not Found")), false, "Not Found should NOT be transient");

  console.log('✅ ToolExecutor basic classification tests passed');
}

let mockExecutionCount = 0;

testToolExecutor().catch(e => {
  console.error('❌ ToolExecutor tests failed:', e);
  process.exit(1);
});
