import { ParameterStore } from './src/core/optimization/ParameterStore';
import { OptimizationEngine } from './src/core/learning/OptimizationEngine';
import { AgentEvaluator } from './src/core/evaluation/AgentEvaluator';
import { config } from './src/config/env';

async function testAutoTuning() {
    console.log('\n--- Starting Auto-Tuning Safety Tests ---');

    // Enable safe mode
    config.learning.enabled = true;
    config.learning.mode = 'safe';

    // 1. Initial Values
    console.log('Initial plannerBias:', ParameterStore.get('plannerBias'));

    // 2. Simulate Performance Degradation (B < A)
    console.log('\nSimulating performance degradation (Variant B failing)...');
    AgentEvaluator.clearStats();
    for (let i = 0; i < 10; i++) {
        AgentEvaluator.evaluateRun({ success: false, latencyMs: 5000, toolUsageCount: 0, errorCount: 1, totalIterations: 1 }, 'B');
        AgentEvaluator.evaluateRun({ success: true, latencyMs: 1000, toolUsageCount: 1, errorCount: 0, totalIterations: 1 }, 'A');
    }

    // Trigger feedback loop to trigger tuneParameters
    for (let i = 0; i < 10; i++) {
        OptimizationEngine.processFeedback({
            requestId: 'test',
            success: false,
            latencyMs: 5000,
            executionPath: 'unknown',
            errorCount: 1,
            timestamp: new Date().toISOString()
        });
    }

    const tunedBias = ParameterStore.get('plannerBias');
    console.log('Tuned plannerBias (should be lower):', tunedBias);
    if (tunedBias < 0.7) console.log('✅ Rule 1: Correctly tuned down bias after failure');

    // 3. Verify Bounds
    console.log('\nTesting Bounds (Maxing out)...');
    for (let i = 0; i < 100; i++) {
        ParameterStore.update('plannerBias', 1);
    }
    const maxedBias = ParameterStore.get('plannerBias');
    console.log('Maxed plannerBias:', maxedBias);
    if (maxedBias <= 0.9) console.log('✅ Safety: plannerBias stayed within bounds (max 0.9)');

    // 4. Reset
    console.log('\nTesting Reset...');
    ParameterStore.resetAll();
    console.log('Reset plannerBias:', ParameterStore.get('plannerBias'));
    if (ParameterStore.get('plannerBias') === 0.7) console.log('✅ Reset: Parameters restored to default');

    console.log('\n--- Auto-Tuning Tests Complete ---');
}

testAutoTuning().catch(console.error);
