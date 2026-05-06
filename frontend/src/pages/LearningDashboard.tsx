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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 'var(--space-4)' }}>
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sincronizando Heurísticas...</span>
                </div>
            </AppLayout>
        );
    }

    if (!hasData && !isLoading) {
        return (
            <AppLayout sidebar={<AppSidebar />}>
                <PageHeader title="Inteligência" subtitle="Estatísticas de aprendizado do agente" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                    <EmptyState
                        icon={<BrainCircuit size={48} />}
                        title="O agente ainda está aprendendo"
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

            <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                {/* Metrics Grid Wrapper */}
                <MetricGrid metrics={efficiencyMetrics} />

                {/* Charts + Insights Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 'var(--space-6)' }} className="lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <Card padding="lg" border shadow="sm">
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
                            <Card padding="lg" border shadow="sm" style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%' }}>
                                <Badge variant="ghost" style={{ marginBottom: 'var(--space-2)' }}>Telemetry Module</Badge>
                                <p style={{ fontSize: 'var(--text-sm)', fontStyle: 'italic', color: 'var(--color-text-tertiary)', maxWidth: '200px' }}>
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

