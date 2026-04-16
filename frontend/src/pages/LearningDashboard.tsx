import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { IntelligenceInsights } from '@/components/dashboard/IntelligenceInsights';
import { MetricGrid } from '@/components/dashboard/MetricGrid';
import { useAgentStore } from '@/stores/agentStore';
import { transformLearningMetrics } from '@/lib/adapters/learningAdapter';
import { PageContainer, Stack, Section } from '@/components/ui/Layout';
import { Title, Body, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Activity } from 'lucide-react';

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
        ? 'Agent is still learning. Data will appear as requests are processed.'
        : cacheEfficiency > 70
            ? `High cache efficiency at ${cacheEfficiency.toFixed(0)}% — the agent is operating optimally.`
            : fallbackRate > 30
                ? `Fallback rate at ${fallbackRate.toFixed(0)}% — some skills may need attention.`
                : avgLatency < 500
                    ? `Low latency at ${avgLatency.toFixed(0)}ms — response times are excellent.`
                    : 'The agent is processing and improving with each interaction.';

    if (isLoading && !rawMetrics) {
        return (
            <PageContainer className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <Caption>Sincronizando Heurísticas...</Caption>
            </PageContainer>
        );
    }

    if (!hasData && !isLoading) {
        return (
            <PageContainer className="flex items-center justify-center h-[60vh]">
                <EmptyState
                    icon={BrainCircuit}
                    title="Agent is still learning"
                    description="The intelligence engine will start generating insights and metrics as the agent processes real requests."
                    className="py-16 max-w-lg"
                />
            </PageContainer>
        );
    }

    // Compute success rate from top skills
    const topSkills = metrics?.topSkills || [];
    const totalUsage = topSkills.reduce((sum: number, s: any) => sum + (s.usageCount || 0), 0);
    const totalSuccess = topSkills.reduce((sum: number, s: any) => sum + (s.successCount || 0), 0);
    const successRate = totalUsage > 0 ? ((totalSuccess / totalUsage) * 100) : 0;

    const efficiencyMetrics = [
        { title: 'Success Rate', value: `${successRate.toFixed(1)}%`, subtitle: 'Overall execution accuracy', trend: successRate > 80 ? 'up' as const : successRate > 50 ? 'neutral' as const : 'down' as const },
        { title: 'Avg Latency', value: `${(avgLatency).toFixed(0)}ms`, subtitle: 'System-wide response', trend: avgLatency < 500 ? 'up' as const : avgLatency < 2000 ? 'neutral' as const : 'down' as const },
        { title: 'Cache Efficiency', value: `${cacheEfficiency.toFixed(1)}%`, subtitle: 'Calls saved by cache', trend: cacheEfficiency > 50 ? 'up' as const : cacheEfficiency > 20 ? 'neutral' as const : 'down' as const },
        { title: 'Fallback Rate', value: `${fallbackRate.toFixed(1)}%`, subtitle: 'Deterministic fallbacks', trend: fallbackRate < 10 ? 'up' as const : fallbackRate < 30 ? 'neutral' as const : 'down' as const },
    ];

    const safeInsights = [
        ...mostReliableSkills.map((s, i) => ({ id: `rel-${i}`, type: 'performance', content: `${s.skillId}: ${s.description} (${s.metricValue})`, priority: 'high' as const })),
        ...failurePatterns.map((s, i) => ({ id: `fail-${i}`, type: 'system', content: `Observing ${s.skillId}: ${s.description} (${s.metricValue})`, priority: 'medium' as const })),
        ...mostUsedTools.map((s, i) => ({ id: `tool-${i}`, type: 'cache', content: `Core routing via ${s.skillId} (${s.metricValue})`, priority: 'low' as const })),
        ...improvingSkills.map((s, i) => ({ id: `imp-${i}`, type: 'performance', content: `Optimization engine improved ${s.skillId} to ${s.metricValue}`, priority: 'medium' as const }))
    ];

    return (
        <PageContainer>
            <Stack className="gap-8">
                {/* Header */}
                <Section>
                    <header className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm shadow-primary/10">
                                <BrainCircuit className="h-5 w-5" />
                            </div>
                            <div>
                                <Title as="h1" className="text-2xl md:text-3xl">Agent Intelligence</Title>
                                <Body as="p" className="mt-1 max-w-xl">{summaryText}</Body>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <Badge variant="glass" className="text-[8px] gap-1">
                                <Activity className="h-3 w-3 animate-pulse" />
                                Live
                            </Badge>
                        </div>
                    </header>
                </Section>

                {/* Metrics Grid */}
                <MetricGrid metrics={efficiencyMetrics} />

                {/* Charts + Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <PerformanceChart
                            top={metrics?.topSkills || []}
                            worst={metrics?.worstSkills || []}
                            worstTitle="Skills Sob Observação"
                        />
                    </div>

                    <div>
                        {featureFlags.UI_LEARNING_INSIGHTS ? (
                            <IntelligenceInsights
                                insights={safeInsights || []}
                            />
                        ) : (
                            <div className="glass-card p-6 border-dashed border-white/5 flex flex-col items-center text-center h-full justify-center">
                                <Caption className="mb-2">Automated Insights Module</Caption>
                                <Body as="p" className="italic max-w-xs">
                                    Engine telemetry is running in stealth mode. Toggle the UI_LEARNING_INSIGHTS flag to enable.
                                </Body>
                            </div>
                        )}
                    </div>
                </div>
            </Stack>
        </PageContainer>
    );
}
