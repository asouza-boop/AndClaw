import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { IntelligenceInsights } from '@/components/dashboard/IntelligenceInsights';
import { MetricGrid } from '@/components/dashboard/MetricGrid';
import { useAgentStore } from '@/stores/agentStore';
import { transformLearningMetrics } from '@/lib/adapters/learningAdapter';

export default function LearningDashboard() {
    const { featureFlags } = useAgentStore();
    const { data: rawMetrics, isLoading } = useQuery({
        queryKey: ['learning-metrics'],
        queryFn: () => apiFetch<any>('/api/learning/dashboard'),
        refetchInterval: 10000,
    });

    const dashboardState = transformLearningMetrics(rawMetrics);
    const { metrics, mostReliableSkills, failurePatterns, mostUsedTools, improvingSkills } = dashboardState;

    if (isLoading && !rawMetrics) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-white/20">Sincronizando Heurísticas...</p>
            </div>
        );
    }

    const efficiencyMetrics = [
        { title: 'Cache Efficiency', value: `${(metrics?.cacheEfficiency || 0).toFixed(1)}%`, subtitle: 'Calls saved by cache', trend: 'up' as const },
        { title: 'Avg Latency', value: `${(metrics?.avgLatency || 0).toFixed(0)}ms`, subtitle: 'System-wide response', trend: 'down' as const },
        { title: 'Fallback Rate', value: `${(metrics?.fallbackRate || 0).toFixed(1)}%`, subtitle: 'Deterministic fallbacks', trend: 'neutral' as const },
        { title: 'Knowledge Growth', value: (metrics?.topSkills || []).length || 0, subtitle: 'Active semantic records', trend: 'up' as const },
    ];

    const safeInsights = [
        ...mostReliableSkills.map((s, i) => ({ id: `rel-${i}`, type: 'performance', content: `${s.skillId}: ${s.description} (${s.metricValue})`, priority: 'high' as const })),
        ...failurePatterns.map((s, i) => ({ id: `fail-${i}`, type: 'system', content: `Observing ${s.skillId}: ${s.description} (${s.metricValue})`, priority: 'medium' as const })),
        ...mostUsedTools.map((s, i) => ({ id: `tool-${i}`, type: 'cache', content: `Core routing via ${s.skillId} (${s.metricValue})`, priority: 'low' as const })),
        ...improvingSkills.map((s, i) => ({ id: `imp-${i}`, type: 'performance', content: `Optimization engine improved ${s.skillId} to ${s.metricValue}`, priority: 'medium' as const }))
    ];

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700 max-w-[1400px] mx-auto">
            <header>
                <h1 className="text-3xl font-black text-white tracking-tighter mb-1">Intelligence Dashboard</h1>
                <p className="text-sm text-white/40 italic">Monitoramento em tempo real da evolução cognitiva do AndClaw.</p>
            </header>

            <MetricGrid metrics={efficiencyMetrics || []} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <PerformanceChart 
                        top={metrics?.topSkills || []} 
                        worst={metrics?.worstSkills || []} 
                        worstTitle="Skills Sob Observação"
                    />
                </div>

                <div className="space-y-8">
                    {featureFlags.UI_LEARNING_INSIGHTS ? (
                        <IntelligenceInsights 
                            insights={safeInsights || []} 
                        />
                    ) : (
                        <div className="glass-card p-8 border-dashed border-white/5 flex flex-col items-center text-center opacity-50 h-full">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Automated Insights Module</p>
                            <p className="text-[11px] text-white/60 leading-relaxed italic">Engine telemetry currently running in stealth mode. Insights processing is available but toggled off via active UI feature flag.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
