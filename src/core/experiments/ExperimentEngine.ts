import { logger } from '@/infra/logger';

export type ExperimentVariant = 'A' | 'B';

/**
 * Experiment Engine for deterministic A/B testing.
 *
 * Maps identifiers (requestId, userId) to specific variants using a hashing strategy.
 */
export class ExperimentEngine {
    /**
     * Determines the active variant for a given identifier.
     * Uses a simple, zero-dependency numeric hash for deterministic assignment.
     */
    public static getVariant(id?: string): ExperimentVariant {
        if (!id) {
            return 'A'; // Default to Baseline if no ID provided
        }

        const hash = this.computeHash(id);
        const variant: ExperimentVariant = (hash % 2 === 0) ? 'A' : 'B';

        logger.info('experiment.variant.assigned', {
            id,
            variant,
            mode: 'deterministic'
        });

        return variant;
    }

    /**
     * Simple numeric hash implementation based on string characters.
     */
    private static computeHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
}
