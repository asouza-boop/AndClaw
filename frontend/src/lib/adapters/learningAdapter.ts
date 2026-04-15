export interface LearningMetricsRaw {
    cacheEfficiency?: number;
    avgLatency?: number;
    fallbackRate?: number;
    topSkills?: any[];
    worstSkills?: any[];
}

export interface SkillInsight {
    skillId: string;
    description: string;
    metricValue: string | number;
    trend: 'up' | 'down' | 'neutral';
}

export interface LearningDashboardState {
    metrics: LearningMetricsRaw;
    mostReliableSkills: SkillInsight[];
    failurePatterns: SkillInsight[];
    mostUsedTools: SkillInsight[];
    improvingSkills: SkillInsight[];
}

export function transformLearningMetrics(raw: LearningMetricsRaw | null | undefined): LearningDashboardState {
    const safeRaw = raw || {};
    const topSkills = safeRaw.topSkills || [];
    const worstSkills = safeRaw.worstSkills || [];
    const allSkills = [...topSkills, ...worstSkills];

    // Compute most reliable skills (high success rate)
    const mostReliableSkills = topSkills
        .slice(0, 3)
        .map(s => {
            const successRate = s.usageCount ? (s.successCount / s.usageCount) * 100 : 0;
            return {
                skillId: s.skillId,
                description: 'Consistently high completion rate',
                metricValue: `${successRate.toFixed(1)}%`,
                trend: 'up' as const
            };
        });

    // Compute failure patterns (high failure rate or latency)
    const failurePatterns = worstSkills
        .slice(0, 3)
        .map(s => {
            const failureRate = s.usageCount ? (s.failureCount / s.usageCount) * 100 : 0;
            return {
                skillId: s.skillId,
                description: 'Frequent fallback executions',
                metricValue: `${failureRate.toFixed(1)}% Fail`,
                trend: 'down' as const
            };
        });

    // Compute most used tools (by usage count)
    const mostUsedTools = allSkills
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 3)
        .map(s => ({
            skillId: s.skillId,
            description: 'Core workflow dependency',
            metricValue: `${s.usageCount} calls`,
            trend: 'neutral' as const
        }));

    // Compute improving skills (from top skills as proxy for optimized)
    const improvingSkills = topSkills
        .filter(s => (s.usageCount || 0) > 5)
        .slice(0, 3)
        .map(s => ({
            skillId: s.skillId,
            description: 'Latency optimization active',
            metricValue: `${s.avgLatencyMs}ms`,
            trend: 'up' as const
        }));

    return {
        metrics: safeRaw,
        mostReliableSkills,
        failurePatterns,
        mostUsedTools,
        improvingSkills
    };
}
