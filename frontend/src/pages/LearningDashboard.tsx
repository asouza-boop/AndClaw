import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { IntelligenceInsights } from '@/components/dashboard/IntelligenceInsights';
import { MetricGrid } from '@/components/dashboard/MetricGrid';

export default function LearningDashboard() {
    const { data: metrics, isLoading } = useQuery({
        queryKey: ['learning-metrics'],
        queryFn: () => apiFetch<any>('/api/learning/dashboard'),
        refetchInterval: 10000,
    });

    if (isLoading) {
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
        { title: 'Knowledge Growth', value: metrics?.topSkills?.length || 0, subtitle: 'Active semantic records', trend: 'up' as const },
    ];

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700 max-w-[1400px] mx-auto">
            <header>
                <h1 className="text-3xl font-black text-white tracking-tighter mb-1">Intelligence Dashboard</h1>
                <p className="text-sm text-white/40 italic">Monitoramento em tempo real da evolução cognitiva do AndClaw.</p>
            </header>

            <MetricGrid metrics={efficiencyMetrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <PerformanceChart 
                        top={metrics?.topSkills || []} 
                        worst={metrics?.worstSkills || []} 
                        worstTitle="Skills Sob Observação"
                    />
                </div>

                <div className="space-y-8">
                    <IntelligenceInsights 
                        insights={[
                            { id: '1', type: 'performance', content: 'Skill AWS-Cost-Analyzer performando 15% acima da média.', priority: 'high' },
                            { id: '2', type: 'cache', content: 'Taxa de acerto de cache subiu para 42% na última hora.', priority: 'medium' },
                            { id: '3', type: 'system', content: 'Otimização automática de memória liberou 256MB.', priority: 'low' },
                        ]} 
                    />
                </div>
            </div>
        </div>
    );
}
