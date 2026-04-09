import { logger } from '@/infra/logger';

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
