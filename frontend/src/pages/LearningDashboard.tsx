import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { IntelligenceInsights } from '@/components/dashboard/IntelligenceInsights';
import { MetricGrid } from '@/components/dashboard/MetricGrid';
import { useAgentStore } from '@/stores/agentStore';
import { transformLearningMetrics } from '@/lib/adapters/learningAdapter';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Activity, Zap, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';

export default function LearningDashboard() {
    const { featureFlags } = useAgentStore();
    const { data: rawMetrics, isLoading } = useQuery({
        queryKey: ['learning-metrics'],
        queryFn: () => apiFetch<any>('/api/learning/dashboard'),
        refetchInterval: 10000,
    });

    const dashboardState = transformLearningMetrics(rawMetrics);
    const { metrics, mostReliableSkills, failurePatterns, mostUsedTools, improvingSkills } = dashboardState;

    // Dynamic summary
    const hasData = (metrics?.topSkills || []).length > 0 || (metrics?.worstSkills || []).length > 0;
    const cacheEfficiency = metrics?.cacheEfficiency || 0;
    const fallbackRate = metrics?.fallbackRate || 0;
    const avgLatency = metrics?.avgLatency || 0;

    const summaryText = !hasData
        ? 'Data will appear as requests are processed.'
        : cacheEfficiency > 70
            ? `Eficiência de cache em ${cacheEfficiency.toFixed(0)}% — Operação otimizada.`
            : fallbackRate > 30
                ? `Taxa de fallback em ${fallbackRate.toFixed(0)}% — Atenção recomendada.`
                : avgLatency < 500
                    ? `Latência baixa em ${avgLatency.toFixed(0)}ms — Tempos excelentes.`
                    : 'Processando e evoluindo com cada interação.';

    if (isLoading && !rawMetrics) {
        return (
            <AppLayout sidebar={<AppSidebar />}>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span className="text-xs text-text-tertiary uppercase tracking-widest">Sincronizando Heurísticas...</span>
                </div>
            </AppLayout>
        );
    }

    if (!hasData && !isLoading) {
        return (
            <AppLayout sidebar={<AppSidebar />}>
                <PageHeader title="Inteligência" subtitle="Estatísticas de aprendizado do agente" />
                <div className="flex items-center justify-center h-[60vh]">
                    <EmptyState
                        icon={<BrainCircuit size={48} />}
                        title="Nenhuma inteligência registrada ainda"
                        description="Insights e métricas aparecerão conforme o sistema processa interações reais."
                    />
                </div>
            </AppLayout>
        );
    }

    // Compute success rate from top skills
    const topSkills = metrics?.topSkills || [];
    const totalUsage = topSkills.reduce((sum: number, s: any) => sum + (s.usageCount || 0), 0);
    const totalSuccess = topSkills.reduce((sum: number, s: any) => sum + (s.successCount || 0), 0);
    const successRate = totalUsage > 0 ? ((totalSuccess / totalUsage) * 100) : 0;

    const efficiencyMetrics = [
        { title: 'Taxa de Sucesso', value: `${successRate.toFixed(1)}%`, subtitle: 'Precisão de execução', trend: successRate > 80 ? 'up' as const : successRate > 50 ? 'neutral' as const : 'down' as const },
        { title: 'Latência Média', value: `${(avgLatency).toFixed(0)}ms`, subtitle: 'Resposta do sistema', trend: avgLatency < 500 ? 'up' as const : avgLatency < 2000 ? 'neutral' as const : 'down' as const },
        { title: 'Eficiência Cache', value: `${cacheEfficiency.toFixed(1)}%`, subtitle: 'Chamadas economizadas', trend: cacheEfficiency > 50 ? 'up' as const : cacheEfficiency > 20 ? 'neutral' as const : 'down' as const },
        { title: 'Taxa de Fallback', value: `${fallbackRate.toFixed(1)}%`, subtitle: 'Recuperação determinística', trend: fallbackRate < 10 ? 'up' as const : fallbackRate < 30 ? 'neutral' as const : 'down' as const },
    ];

    const safeInsights = [
        ...mostReliableSkills.map((s, i) => ({ id: `rel-${i}`, type: 'performance', content: `${s.skillId}: ${s.description} (${s.metricValue})`, priority: 'high' as const })),
        ...failurePatterns.map((s, i) => ({ id: `fail-${i}`, type: 'system', content: `Observando ${s.skillId}: ${s.description} (${s.metricValue})`, priority: 'medium' as const })),
        ...mostUsedTools.map((s, i) => ({ id: `tool-${i}`, type: 'cache', content: `Core routing via ${s.skillId} (${s.metricValue})`, priority: 'low' as const })),
        ...improvingSkills.map((s, i) => ({ id: `imp-${i}`, type: 'performance', content: `Optimization engine improved ${s.skillId} to ${s.metricValue}`, priority: 'medium' as const }))
    ];

    return (
        <AppLayout sidebar={<AppSidebar />}>
            <PageHeader 
                title="Inteligência" 
                subtitle={summaryText}
                actions={
                    <Badge variant="success" style={{ fontSize: '10px', gap: 'var(--space-2)' }}>
                        <Activity size={12} className="animate-pulse" /> Live
                    </Badge>
                }
            />

            <div className="mt-8 flex flex-col gap-8">
                {/* Metrics Grid Wrapper */}
                <MetricGrid metrics={efficiencyMetrics} />

                {/* Charts + Insights Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card padding="lg" shadow="sm">
                            <PerformanceChart
                                top={metrics?.topSkills || []}
                                worst={metrics?.worstSkills || []}
                                worstTitle="Skills Sob Observação"
                            />
                        </Card>
                    </div>

                    <div>
                        {featureFlags.UI_LEARNING_INSIGHTS ? (
                            <IntelligenceInsights insights={safeInsights || []} />
                        ) : (
                            <Card padding="lg" shadow="sm" className="border-dashed flex flex-col items-center justify-center text-center h-full">
                                <Badge variant="secondary" className="mb-2">Telemetry Module</Badge>
                                <p className="text-sm italic text-text-tertiary max-w-[200px]">
                                    Engine telemetry running in stealth mode. Toggle flag to enable insights.
                                </p>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

