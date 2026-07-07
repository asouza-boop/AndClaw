import { logger } from '@/infra/logger';
import { config } from '@/config/env';
import { PerformanceStore } from './PerformanceStore';
import { ParameterStore } from '../optimization/ParameterStore';
import { AgentEvaluator } from '../evaluation/AgentEvaluator';

/**
 * Feature flag: learning system is disabled by default.
 * Set LEARNING_ENABLED=true in .env to activate passive data collection.
 */
const LEARNING_ENABLED = process.env.LEARNING_ENABLED === 'true';

export interface FeedbackEntry {
    requestId?: string;
    success: boolean;
    latencyMs: number;
    skillId?: string;
    toolsUsed: string[];
    executionPath: 'skill-plan' | 'action-plan' | 'llm-flow' | 'multi-agent' | 'cache-hit' | 'unknown';
    errorCount: number;
    timestamp: string;
}

/**
 * Passive Feedback Collector.
 * Collects execution feedback data for the learning system.
 * Does NOT affect agent behavior — read-only data collection.
 */
export class FeedbackCollector {
    private static entries: FeedbackEntry[] = [];
    private static readonly MAX_ENTRIES = 500;

    /**
     * Record feedback from a completed execution.
     * No-op if LEARNING_ENABLED is false.
     */
    public static collect(entry: FeedbackEntry): void {
        if (!LEARNING_ENABLED) return;

        // Ring buffer: discard oldest entries when full
        if (FeedbackCollector.entries.length >= FeedbackCollector.MAX_ENTRIES) {
            FeedbackCollector.entries.shift();
        }

        FeedbackCollector.entries.push(entry);

        logger.info('learning.feedback.collected', {
            requestId: entry.requestId,
            success: entry.success,
            latencyMs: entry.latencyMs,
            skillId: entry.skillId,
            executionPath: entry.executionPath,
            toolCount: entry.toolsUsed.length,
        });
    }

    /**
     * Retrieve all collected feedback entries (for OptimizationEngine).
     */
    public static getEntries(): ReadonlyArray<FeedbackEntry> {
        return FeedbackCollector.entries;
    }

    /**
     * Retrieve entries filtered by skillId.
     */
    public static getEntriesForSkill(skillId: string): FeedbackEntry[] {
        return FeedbackCollector.entries.filter(e => e.skillId === skillId);
    }

    /**
     * Clear all entries (for testing).
     */
    public static clear(): void {
        FeedbackCollector.entries = [];
    }

    /**
     * Check if learning is enabled.
     */
    public static isEnabled(): boolean {
        return LEARNING_ENABLED;
    }
}

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
    private static tuneCounter = 0;
    private static readonly TUNE_EVERY = 10;

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

            // 3. Trigger Auto-Tuning
            this.tuneCounter += 1;
            if (this.tuneCounter >= this.TUNE_EVERY) {
                this.tuneCounter = 0;
                this.tuneParameters();
            }
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
     * Self-tuning logic.
     * Adjusts system parameters based on global performance trends.
     */
    private static tuneParameters(): void {
        const isSafeMode = config.learning.enabled && config.learning.mode === 'safe';
        if (!isSafeMode) return;

        try {
            const expStats = AgentEvaluator.getExperimentStats();
            const { stats, summary } = expStats;
            
            // Analyze Strategy B performance vs Baseline A
            const successDelta = stats.B.successRate - stats.A.successRate;
            const latencyB = stats.B.avgLatencyMs;

            logger.info('learning.autotune.eval', {
                totalRuns: summary.totalRuns,
                successDelta,
                latencyB
            });

            // Rule 1: Performance Degradation -> Conservative Mode
            if (successDelta < -0.05 && summary.totalRuns >= 10) {
                logger.warn('learning.autotune.vulnerability_detected', { successDelta });
                ParameterStore.update('plannerBias', -1); // Trust metadata more
                ParameterStore.update('recencyWeight', -1); // Reduce recency risk
                ParameterStore.update('cacheThreshold', -1); // Be more strict with cache
            }

            // Rule 2: Performance OK but Sluggish -> Efficiency Mode
            if (successDelta >= 0 && latencyB > 3000 && summary.totalRuns >= 10) {
                logger.info('learning.autotune.efficiency_mode', { latencyB });
                ParameterStore.update('cacheThreshold', 1); // Allow fuzzier cache hits
                ParameterStore.update('plannerBias', 1);   // Trust stats more (might be better now)
            }

            // Rule 3: High Success -> Exploration Mode
            if (stats.B.successRate > 0.8 && summary.totalRuns >= 20) {
                ParameterStore.update('memoryWeight', 1); // Scale up memory importance
            }

        } catch (error: any) {
            logger.error('learning.autotune.failed', { error: error.message });
        }
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
