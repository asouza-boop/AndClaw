import { logger } from '@/infra/logger';
import { FeedbackCollector, FeedbackEntry } from './FeedbackCollector';
import { PerformanceStore } from './PerformanceStore';

/**
 * Skill score computed by the Optimization Engine.
 * PASSIVE ONLY — does NOT influence planner decisions.
 */
export interface SkillScore {
    skillId: string;
    score: number;          // 0..100 composite score
    successRate: number;    // 0..1
    avgLatencyMs: number;
    usageCount: number;
    lastComputed: string;
}

/**
 * Passive Optimization Engine.
 *
 * Computes skill performance scores based on collected feedback.
 * CRITICAL: Does NOT modify planner behavior. Only computes and stores metrics.
 *
 * Score formula (0..100):
 *   score = (successRate * 70) + (latencyScore * 30)
 *   where latencyScore = max(0, 1 - (avgLatency / 10000))
 *
 * This weights reliability (70%) over speed (30%).
 */
export class OptimizationEngine {
    private static scores: Map<string, SkillScore> = new Map();

    /**
     * Process a feedback entry: update PerformanceStore and recompute the skill score.
     * Safe to call in background — does not throw.
     */
    public static processFeedback(entry: FeedbackEntry): void {
        if (!entry.skillId) return;

        try {
            // 1. Update PerformanceStore
            PerformanceStore.record(entry.skillId, entry.success, entry.latencyMs);

            // 2. Recompute score
            const successRate = PerformanceStore.getSuccessRate(entry.skillId);
            const avgLatencyMs = PerformanceStore.getAvgLatency(entry.skillId);
            const record = PerformanceStore.get(entry.skillId);

            // Latency score: 1.0 if instant, 0.0 if >= 10s
            const latencyScore = Math.max(0, 1 - (avgLatencyMs / 10_000));
            const score = Math.round((successRate * 70) + (latencyScore * 30));

            const skillScore: SkillScore = {
                skillId: entry.skillId,
                score,
                successRate,
                avgLatencyMs,
                usageCount: record?.usageCount || 0,
                lastComputed: new Date().toISOString(),
            };

            OptimizationEngine.scores.set(entry.skillId, skillScore);

            logger.info('skill.score.updated', {
                skillId: entry.skillId,
                score,
                successRate: Math.round(successRate * 100),
                avgLatencyMs,
                usageCount: skillScore.usageCount,
                requestId: entry.requestId,
            });
        } catch (error: any) {
            // Background-safe: never throw from the optimization engine
            logger.warn('learning.optimization.error', {
                skillId: entry.skillId,
                error: error.message,
            });
        }
    }

    /**
     * Update all scores from current feedback history.
     * Useful for batch recomputation.
     */
    public static recomputeAll(): void {
        const entries = FeedbackCollector.getEntries();
        const skillIds = new Set(entries.filter(e => e.skillId).map(e => e.skillId!));

        for (const skillId of skillIds) {
            const skillEntries = entries.filter(e => e.skillId === skillId);
            const lastEntry = skillEntries[skillEntries.length - 1];
            if (lastEntry) {
                // The PerformanceStore already has aggregate data from collect calls,
                // so we just recompute the score from it.
                const successRate = PerformanceStore.getSuccessRate(skillId);
                const avgLatencyMs = PerformanceStore.getAvgLatency(skillId);
                const record = PerformanceStore.get(skillId);

                const latencyScore = Math.max(0, 1 - (avgLatencyMs / 10_000));
                const score = Math.round((successRate * 70) + (latencyScore * 30));

                OptimizationEngine.scores.set(skillId, {
                    skillId,
                    score,
                    successRate,
                    avgLatencyMs,
                    usageCount: record?.usageCount || 0,
                    lastComputed: new Date().toISOString(),
                });
            }
        }

        logger.info('learning.recompute.complete', {
            skillCount: skillIds.size,
        });
    }

    /**
     * Get the computed score for a skill.
     */
    public static getScore(skillId: string): SkillScore | undefined {
        return OptimizationEngine.scores.get(skillId);
    }

    /**
     * Get all computed scores.
     */
    public static getAllScores(): ReadonlyMap<string, SkillScore> {
        return OptimizationEngine.scores;
    }

    /**
     * Clear all scores (for testing).
     */
    public static clear(): void {
        OptimizationEngine.scores.clear();
    }
}
