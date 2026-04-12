import { MetricsService } from './src/core/metrics/MetricsService';
import { PerformanceStore } from './src/core/learning/PerformanceStore';
import { metrics } from './src/infra/metrics/MetricsService';
import { AgentEvaluator } from './src/core/evaluation/AgentEvaluator';

async function verifyDashboard() {
    console.log('\n--- Verifying Dashboard Aggregation ---');

    // 1. Seed some data
    PerformanceStore.record('skill-test', true, 100);
    metrics.increment('cache.hit');
    metrics.increment('cache.miss');
    AgentEvaluator.evaluateRun({ success: true, latencyMs: 150, toolUsageCount: 1, errorCount: 0, totalIterations: 1 }, 'B');

    // 2. Aggregate
    const data = await MetricsService.getDashboardSnapshot();

    console.log('Dashboard Data Snapshot:');
    console.dir(data, { depth: null });

    // 3. Asserts
    if (data.skills.top.length > 0) console.log('✅ Skill data aggregated');
    if (data.cache.hitRate === 0.5) console.log('✅ Cache stats corrected calculated (50% hit rate)');
    if (data.insights.length > 0) console.log('✅ Insights generated');
    if (data.planner.suggestedWinner === 'B') console.log('✅ Planner strategy survivor detected');

    console.log('\n--- Dashboard Verification Complete ---');
}

verifyDashboard().catch(console.error);
