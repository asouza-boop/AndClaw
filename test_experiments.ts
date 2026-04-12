import { ExperimentEngine } from './src/core/experiments/ExperimentEngine';
import { ActionPlanner } from './src/core/planner/ActionPlanner';
import { AgentEvaluator } from './src/core/evaluation/AgentEvaluator';
import { OptimizationEngine } from './src/core/learning/OptimizationEngine';
import { config } from './src/config/env';
import { Skill } from './src/skills/SkillLoader';

// Mocking some skills
const mockSkills: Skill[] = [
    {
        metadata: {
            name: 'skill-alpha',
            description: 'Alpha skill',
            intentTriggers: ['test.intent'],
            priority: 10, // Strategy A will put this first
            status: 'active',
            plannerEnabled: true
        },
        content: '',
        folderName: 'alpha'
    },
    {
        metadata: {
            name: 'skill-beta',
            description: 'Beta skill',
            intentTriggers: ['test.intent'],
            priority: 5, // Strategy B will prefer this IF metrics are better
            status: 'active',
            plannerEnabled: true
        },
        content: '',
        folderName: 'beta'
    }
];

let termPassed = 0;
let termFailed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        termPassed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        termFailed++;
    }
}

async function runTests() {
    console.log('\n--- Testing A/B Experiment System ---');

    // 1. ExperimentEngine - Determinism
    console.log('\nTest 1: Deterministic Assignment');
    const id1 = 'req-123';
    const id2 = 'req-456';
    const v1_a = ExperimentEngine.getVariant(id1);
    const v1_b = ExperimentEngine.getVariant(id1);
    const v2_a = ExperimentEngine.getVariant(id2);
    
    assert(v1_a === v1_b, 'Same ID yields same variant');
    assert(v1_a !== v2_a, 'Different IDs yield different variants (luck dependent but likely with these IDs)');
    
    // 2. ActionPlanner - Variant Switching
    console.log('\nTest 2: ActionPlanner logic per variant');
    const planner = new ActionPlanner();
    const intent = { name: 'test.intent' as any, confidence: 0.9, slots: {}, requestId: 'test-req' };
    
    // Inject metrics favoriting Beta
    (config.learning as any).enabled = true;
    (config.learning as any).mode = 'safe';
    for(let i=0; i<10; i++) {
        OptimizationEngine.processFeedback({
            skillId: 'skill-beta', success: true, latencyMs: 50, requestId: 'r-b-'+i, timestamp: '', toolsUsed: [], executionPath: 'skill-plan', errorCount: 0
        });
        OptimizationEngine.processFeedback({
            skillId: 'skill-alpha', success: false, latencyMs: 2000, requestId: 'r-a-'+i, timestamp: '', toolsUsed: [], executionPath: 'skill-plan', errorCount: 1
        });
    }

    const planA = planner.plan(intent, [], mockSkills, 'A');
    const planB = planner.plan(intent, [], mockSkills, 'B');

    if (planA?.type === 'skill' && planB?.type === 'skill') {
        assert(planA.skills[0] === 'skill-alpha', 'Variant A uses metadata priority (Alpha)');
        assert(planB.skills[0] === 'skill-beta', 'Variant B uses performance optimization (Beta)');
    } else {
        assert(false, 'Failed to generate skill plans');
    }

    // 3. AgentEvaluator - Stats tracking
    console.log('\nTest 3: Metrics tracking per variant');
    AgentEvaluator.clearStats();
    
    // Variant A: 2 runs, 1 success
    AgentEvaluator.evaluateRun({ success: true, latencyMs: 100, toolUsageCount: 1, errorCount: 0, totalIterations: 1 }, 'A');
    AgentEvaluator.evaluateRun({ success: false, latencyMs: 500, toolUsageCount: 0, errorCount: 1, totalIterations: 1 }, 'A');
    
    // Variant B: 1 run, 1 success
    AgentEvaluator.evaluateRun({ success: true, latencyMs: 50, toolUsageCount: 1, errorCount: 0, totalIterations: 1, isFallback: true }, 'B');

    const stats = AgentEvaluator.getExperimentStats();
    assert(stats.stats.A.count === 2, 'Variant A has 2 runs');
    assert(stats.stats.A.successRate === 0.5, 'Variant A success rate is 50%');
    assert(stats.stats.B.count === 1, 'Variant B has 1 run');
    assert(stats.stats.B.fallbackCount === 1, 'Variant B tracked 1 fallback');
    assert(stats.summary.suggestedWinner === 'B', 'Variant B suggested as winner (100% vs 50%)');

    console.log(`\n========================================`);
    console.log(`  Experiment System Results: ${termPassed} passed, ${termFailed} failed`);
    console.log(`========================================\n`);

    if (termFailed > 0) process.exit(1);
}

runTests().catch(console.error);
