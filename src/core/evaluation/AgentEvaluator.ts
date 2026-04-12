import { logger } from '@/infra/logger';
import type { ExperimentVariant } from '../experiments/ExperimentEngine';

export interface AgentMetrics {
    success: boolean;
    toolUsageCount: number;
    latencyMs: number;
    errorCount: number;
    totalIterations: number;
    isFallback?: boolean;
}

export interface VariantStats {
    variant: ExperimentVariant;
    count: number;
    successCount: number;
    totalLatencyMs: number;
    fallbackCount: number;
    avgLatencyMs: number;
    successRate: number;
}

/**
 * Agent Evaluator.
 * 
 * Tracks performance and quality metrics across agent runs.
 * Now extended to support A/B testing stats collection.
 */
export class AgentEvaluator {
    private static stats: Record<ExperimentVariant, VariantStats> = {
        'A': { variant: 'A', count: 0, successCount: 0, totalLatencyMs: 0, fallbackCount: 0, avgLatencyMs: 0, successRate: 0 },
        'B': { variant: 'B', count: 0, successCount: 0, totalLatencyMs: 0, fallbackCount: 0, avgLatencyMs: 0, successRate: 0 }
    };

    /**
     * Evaluates a completed or failed AgentLoop run.
     * Logs performance and status, and updates A/B testing metrics.
     */
    public static evaluateRun(metrics: AgentMetrics, variant: ExperimentVariant = 'A'): void {
        const stats = this.stats[variant];
        
        // Update in-memory stats
        stats.count += 1;
        stats.totalLatencyMs += metrics.latencyMs;
        if (metrics.success) stats.successCount += 1;
        if (metrics.isFallback) stats.fallbackCount += 1;

        // Recompute averages
        stats.avgLatencyMs = Math.round(stats.totalLatencyMs / stats.count);
        stats.successRate = stats.successCount / stats.count;

        logger.info('agent.eval.completed', {
            variant,
            success: metrics.success,
            latencyMs: metrics.latencyMs,
            isFallback: !!metrics.isFallback,
            stats: {
                successRate: Math.round(stats.successRate * 100),
                avgLatencyMs: stats.avgLatencyMs
            }
        });

        console.log(`\n--- [Agent Evaluation Metrics | Variant ${variant}] ---`);
        console.log(`[Observability] agent.eval.latency: ${metrics.latencyMs}ms`);
        console.log(`[Observability] agent.eval.toolsUsage: ${metrics.toolUsageCount} calls`);
        console.log(`[Observability] agent.eval.iterations: ${metrics.totalIterations}`);
        console.log(`[Observability] agent.eval.internalErrors: ${metrics.errorCount}`);
        console.log(`[Observability] agent.eval.fallback: ${metrics.isFallback ? 'YES' : 'NO'}`);

        if (metrics.success) {
            console.log(`[Observability] agent.eval.success: Agent completed the workflow successfully.`);
        } else {
            console.warn(`[Observability] agent.eval.failure: Agent was aborted, blocked, or crashed.`);
        }
        console.log('----------------------------------\n');
    }

    /**
     * Retrieves current experiment statistics.
     */
    public static getExperimentStats() {
        return {
            stats: this.stats,
            summary: {
                totalRuns: this.stats.A.count + this.stats.B.count,
                suggestedWinner: this.stats.B.successRate > this.stats.A.successRate ? 'B' : 'A',
                improvement: this.stats.A.successRate > 0 
                    ? ((this.stats.B.successRate - this.stats.A.successRate) / this.stats.A.successRate * 100).toFixed(2) + '%'
                    : 'N/A'
            }
        };
    }

    /**
     * Clears stats (for testing).
     */
    public static clearStats(): void {
        this.stats.A = { variant: 'A', count: 0, successCount: 0, totalLatencyMs: 0, fallbackCount: 0, avgLatencyMs: 0, successRate: 0 };
        this.stats.B = { variant: 'B', count: 0, successCount: 0, totalLatencyMs: 0, fallbackCount: 0, avgLatencyMs: 0, successRate: 0 };
    }
}
