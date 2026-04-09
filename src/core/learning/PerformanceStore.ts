import { logger } from '@/infra/logger';

/**
 * In-memory performance store for skill metrics.
 * Completely isolated from the existing memory/DB systems.
 * Stores aggregate metrics per skill for passive optimization scoring.
 */
export interface SkillPerformanceRecord {
    skillId: string;
    successCount: number;
    failureCount: number;
    totalLatencyMs: number;
    usageCount: number;
    lastUpdated: string;
}

export class PerformanceStore {
    private static store: Map<string, SkillPerformanceRecord> = new Map();

    /**
     * Record a single execution result for a skill.
     */
    public static record(skillId: string, success: boolean, latencyMs: number): void {
        const existing = PerformanceStore.store.get(skillId);

        if (existing) {
            existing.usageCount += 1;
            existing.totalLatencyMs += latencyMs;
            if (success) {
                existing.successCount += 1;
            } else {
                existing.failureCount += 1;
            }
            existing.lastUpdated = new Date().toISOString();
        } else {
            PerformanceStore.store.set(skillId, {
                skillId,
                successCount: success ? 1 : 0,
                failureCount: success ? 0 : 1,
                totalLatencyMs: latencyMs,
                usageCount: 1,
                lastUpdated: new Date().toISOString(),
            });
        }

        logger.info('learning.performance.recorded', {
            skillId,
            success,
            latencyMs,
            usageCount: PerformanceStore.store.get(skillId)!.usageCount,
        });
    }

    /**
     * Get performance record for a specific skill.
     */
    public static get(skillId: string): SkillPerformanceRecord | undefined {
        return PerformanceStore.store.get(skillId);
    }

    /**
     * Get all performance records.
     */
    public static getAll(): ReadonlyMap<string, SkillPerformanceRecord> {
        return PerformanceStore.store;
    }

    /**
     * Compute the success rate for a skill (0..1).
     */
    public static getSuccessRate(skillId: string): number {
        const record = PerformanceStore.store.get(skillId);
        if (!record || record.usageCount === 0) return 0;
        return record.successCount / record.usageCount;
    }

    /**
     * Compute the average latency for a skill in milliseconds.
     */
    public static getAvgLatency(skillId: string): number {
        const record = PerformanceStore.store.get(skillId);
        if (!record || record.usageCount === 0) return 0;
        return Math.round(record.totalLatencyMs / record.usageCount);
    }

    /**
     * Clear all records (for testing).
     */
    public static clear(): void {
        PerformanceStore.store.clear();
    }
}
