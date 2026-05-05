import { EvaluationService } from './EvaluationService';
import assert from 'assert';

function testEvaluationService() {
  const service = new EvaluationService();

  console.log('Running EvaluationService tests...');

  // Test 7: evaluateStep returns passed:true for clean result
  const res1 = service.evaluateStep('any-tool', 'This is a normal result');
  assert.strictEqual(res1.passed, true, 'Clean result should pass');

  // Test 8: evaluateStep returns passed:false for result containing 'unauthorized'
  const res2 = service.evaluateStep('any-tool', 'Error: unauthorized access');
  assert.strictEqual(res2.passed, false, 'Unauthorized result should fail');
  assert.ok(res2.reason?.toLowerCase().includes('termo restrito'), 'Reason should mention restricted term');

  const res3 = service.evaluateStep('any-tool', 'Outcome: forbidden action');
  assert.strictEqual(res3.passed, false, 'Forbidden result should fail');

  console.log('✅ EvaluationService tests passed');
}

testEvaluationService();
