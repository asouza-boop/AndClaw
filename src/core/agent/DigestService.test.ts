import { DigestService } from './DigestService';
import { agentEvents, MEMORY_DIGESTED } from '../events/AgentEvents';
import assert from 'assert';

async function test() {
  console.log("Running DigestService event tests...");

  const mockProvider: any = {};
  const mockContext: any = { userId: 'user-1' };

  // Test 1: Successful process() emits MEMORY_DIGESTED
  {
    let emitted = false;
    const onDigest = () => { emitted = true; };
    agentEvents.once(MEMORY_DIGESTED, onDigest);

    const service = new DigestService({
      isMemorable: () => true,
      digest: () => Promise.resolve('fact'),
      addSemanticMemory: () => Promise.resolve(),
      logger: { info: () => {}, error: () => {} }
    });

    await service.process('input', 'output', mockProvider, mockContext);
    
    // Wait for the background task to complete (it uses .then() without await)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert.strictEqual(emitted, true, "Should have emitted MEMORY_DIGESTED on success");
    console.log("✅ Success: Emitted MEMORY_DIGESTED");
  }

  // Test 2: process() error does NOT emit MEMORY_DIGESTED
  {
    let emitted = false;
    const onDigest = () => { emitted = true; };
    agentEvents.once(MEMORY_DIGESTED, onDigest);

    const service = new DigestService({
      isMemorable: () => true,
      digest: () => Promise.reject(new Error('failed')),
      logger: { info: () => {}, error: () => {} }
    });

    await service.process('input', 'output', mockProvider, mockContext);
    
    // Wait for the background task
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert.strictEqual(emitted, false, "Should NOT have emitted MEMORY_DIGESTED on failure");
    console.log("✅ Success: Did NOT emit on error");
  }

  agentEvents.removeAllListeners();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
