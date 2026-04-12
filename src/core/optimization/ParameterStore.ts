import { logger } from '@/infra/logger';

export interface TuningParameter {
    key: string;
    value: number;
    defaultValue: number;
    min: number;
    max: number;
    step: number;
    lastDelta: number;
}

/**
 * Parameter Store for system auto-tuning.
 * Manages dynamic parameters with safety bounds and rollback support.
 */
export class ParameterStore {
    private static params: Map<string, TuningParameter> = new Map([
        ['memoryWeight', { key: 'memoryWeight', value: 1.0, defaultValue: 1.0, min: 0.1, max: 2.0, step: 0.05, lastDelta: 0 }],
        ['recencyWeight', { key: 'recencyWeight', value: 0.15, defaultValue: 0.15, min: 0.0, max: 1.0, step: 0.01, lastDelta: 0 }],
        ['cacheThreshold', { key: 'cacheThreshold', value: 0.1, defaultValue: 0.1, min: 0.01, max: 0.5, step: 0.005, lastDelta: 0 }],
        ['plannerBias', { key: 'plannerBias', value: 0.7, defaultValue: 0.7, min: 0.1, max: 0.9, step: 0.02, lastDelta: 0 }]
    ]);

    /**
     * Get a parameter value.
     */
    public static get(key: string): number {
        const param = this.params.get(key);
        return param ? param.value : 0;
    }

    /**
     * Update a parameter value by applying a delta, respecting safety bounds.
     */
    public static update(key: string, multiplier: number): void {
        const param = this.params.get(key);
        if (!param) return;

        const delta = param.step * multiplier;
        const newValue = Math.min(param.max, Math.max(param.min, param.value + delta));
        
        if (newValue !== param.value) {
            param.lastDelta = newValue - param.value;
            param.value = newValue;
            
            logger.info('parameter.updated', {
                key,
                value: param.value,
                delta: param.lastDelta,
                reachedLimit: newValue === param.min || newValue === param.max
            });
        }
    }

    /**
     * Rollback the last change for a parameter.
     */
    public static rollback(key: string): void {
        const param = this.params.get(key);
        if (!param || param.lastDelta === 0) return;

        param.value -= param.lastDelta;
        logger.info('parameter.rollback', { key, newValue: param.value });
        param.lastDelta = 0;
    }

    /**
     * Reset all parameters to their default values.
     */
    public static resetAll(): void {
        for (const param of this.params.values()) {
            param.value = param.defaultValue;
            param.lastDelta = 0;
        }
        logger.info('parameter.reset.all');
    }

    /**
     * Get all parameters for the API/Dashboard.
     */
    public static getAll(): TuningParameter[] {
        return Array.from(this.params.values());
    }
}
