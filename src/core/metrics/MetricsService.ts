import { PerformanceStore, SkillPerformanceRecord } from '../learning/PerformanceStore';
import { metrics as infraMetrics } from '@/infra/metrics/MetricsService';
import { AgentEvaluator } from '../evaluation/AgentEvaluator';
import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';

export interface DashboardData {
    skills: {
        top: SkillPerformanceRecord[];
        worst: SkillPerformanceRecord[];
    };
    cache: {
        hitCount: number;
        missCount: number;
        saveCount: number;
        hitRate: number;
        efficiency: number;
    };
    memory: {
        totalRecords: number;
        searchCount: number;
        avgSearchLatency: number;
    };
    planner: {
        totalRuns: number;
        activeVariant: string;
        improvement: string;
        suggestedWinner: string;
        fallbackRate: number;
    };
    insights: string[];
}

/**
 * Domain-level Metrics Service for the Learning Dashboard.
 * Aggregates data from multiple sources to provide a high-level view of system intelligence.
 */
export class MetricsService {
    /**
     * Aggregates all learning and execution metrics into a single dashboard snapshot.
     */
    public static async getDashboardSnapshot(): Promise<DashboardData> {
        try {
            const skillRecords = Array.from(PerformanceStore.getAll().values());
            const sortedSkills = [...skillRecords].sort((a, b) => {
                const aRate = a.usageCount > 0 ? a.successCount / a.usageCount : 0;
                const bRate = b.usageCount > 0 ? b.successCount / b.usageCount : 0;
                return bRate - aRate;
            });

            const infraSnapshot = infraMetrics.getMetrics();
            const cacheHits = infraSnapshot['cache.hit']?.value || 0;
            const cacheMisses = infraSnapshot['cache.miss']?.value || 0;
            const cacheSaves = infraSnapshot['cache.save']?.value || 0;
            const cacheTotal = cacheHits + cacheMisses;
            
            const memoryCountRows = await query<{ count: number }>('SELECT count(*) as count FROM memory_items');
            const memoryTotal = Number(memoryCountRows[0]?.count || 0);
            
            const expStats = AgentEvaluator.getExperimentStats();
            
            const data: DashboardData = {
                skills: {
                    top: sortedSkills.slice(0, 5),
                    worst: sortedSkills.reverse().slice(0, 5)
                },
                cache: {
                    hitCount: cacheHits,
                    missCount: cacheMisses,
                    saveCount: cacheSaves,
                    hitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0,
                    efficiency: cacheHits * 10.5 // Hypothetical: 10.5s saved per hit
                },
                memory: {
                    totalRecords: memoryTotal,
                    searchCount: infraSnapshot['memory.search.count']?.value || 0,
                    avgSearchLatency: infraSnapshot['memory.search.latency']?.average || 0
                },
                planner: {
                    totalRuns: expStats.summary.totalRuns,
                    activeVariant: expStats.summary.suggestedWinner,
                    improvement: expStats.summary.improvement,
                    suggestedWinner: expStats.summary.suggestedWinner,
                    fallbackRate: (expStats.stats.A.fallbackCount + expStats.stats.B.fallbackCount) / (expStats.summary.totalRuns || 1)
                },
                insights: this.generateInsights(sortedSkills, cacheHits, cacheMisses, expStats)
            };

            return data;
        } catch (error) {
            logger.error('metrics.dashboard.failed', { error });
            throw error;
        }
    }

    /**
     * Generates heuristic-based textual insights for the dashboard.
     */
    private static generateInsights(skills: SkillPerformanceRecord[], cacheHits: number, cacheMisses: number, expStats: any): string[] {
        const insights: string[] = [];

        // Skill Insights
        if (skills.length > 1) {
            const top = skills[0];
            const bottom = skills[skills.length - 1];
            if (top && bottom && top.successCount > bottom.successCount) {
                insights.push(`A Skill "${top.skillId}" está performando significativamente melhor que "${bottom.skillId}".`);
            }
        }

        // Cache Insights
        const hitRate = cacheHits / (cacheHits + cacheMisses || 1);
        if (hitRate > 0.3) {
            insights.push(`O Cache Semântico está economizando aproximadamente ${(cacheHits * 0.5).toFixed(1)} minutos de processamento LLM.`);
        } else if (cacheMisses > 10) {
            insights.push('A taxa de acerto do cache está baixa. Considere ajustar o threshold de similaridade.');
        }

        // Planner Insights
        if (expStats.summary.totalRuns > 5) {
            const imp = parseFloat(expStats.summary.improvement.replace('%', ''));
            if (imp > 0) {
                insights.push(`A Estratégia B (Otimizada) mostra uma melhoria de ${expStats.summary.improvement} na taxa de sucesso.`);
            } else if (imp < 0) {
                insights.push('A Estratégia A (Baseline) continua sendo mais estável que a nova otimização.');
            }
        }

        // Default if empty
        if (insights.length === 0) {
            insights.push('Iniciando coleta de dados... Realize mais interações para gerar insights detalhados.');
        }

        return insights;
    }
}
