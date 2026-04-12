import React, { useEffect, useState } from 'react';
import { SkillPerformanceChart } from '../components/learning/SkillPerformanceChart';
import { EfficiencyMetricCard } from '../components/learning/EfficiencyMetricCard';
import { IntelligenceInsights } from '../components/learning/IntelligenceInsights';
import { useAgentStore } from '../stores/agentStore';

interface DashboardData {
    skills: {
        top: any[];
        worst: any[];
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

const LearningDashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const resp = await fetch('/api/learning/dashboard');
                const json = await resp.json();
                if (json.ok) {
                    setData(json.data);
                }
            } catch (err) {
                console.error('Failed to fetch learning metrics', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    if (!data) return <div className="p-8 text-white/40 italic">Erro ao carregar métricas de inteligência. Tente novamente mais tarde.</div>;

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter mb-1">System Intelligence</h1>
                  <p className="text-sm text-white/40">Engenharia de métricas e evolução cognitiva AndClaw.</p>
                </div>
                <div className="flex items-center gap-3 p-1.5 bg-white/5 rounded-2xl border border-white/5">
                  <div className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20">
                    Sugerido: Variante {data.planner.suggestedWinner}
                  </div>
                  <div className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/30">
                    Live Engine Trace
                  </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <EfficiencyMetricCard 
                    title="Economia Estimada"
                    value={`+${data.cache.efficiency.toFixed(0)}s`}
                    subtitle="Tempo via Cache"
                    trend="up"
                />
                <EfficiencyMetricCard 
                    title="Taxa de Acerto"
                    value={`${(data.cache.hitRate * 100).toFixed(1)}%`}
                    subtitle="Indice de Cache"
                    trend="neutral"
                />
                <EfficiencyMetricCard 
                    title="Neural Memory"
                    value={data.memory.totalRecords}
                    subtitle="Records via SQL"
                    trend="up"
                />
                <EfficiencyMetricCard 
                    title="Fallback Rate"
                    value={`${(data.planner.fallbackRate * 100).toFixed(1)}%`}
                    subtitle="Aderência"
                    trend={data.planner.fallbackRate < 0.2 ? 'down' : 'up'}
                />
            </div>

            <IntelligenceInsights insights={data.insights} />

            <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                   <div className="w-1 h-6 bg-primary rounded-full transition-all group-hover:h-8" />
                   <h2 className="text-xl font-black text-white tracking-tight uppercase">Skill Intelligence</h2>
                </div>
                <SkillPerformanceChart top={data.skills.top} worst={data.skills.worst} />
            </section>

            <footer className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/5 to-transparent">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">A/B Performance Yield</span>
                    <span className="text-4xl font-black text-primary tracking-tighter">{data.planner.improvement}</span>
                </div>
                <div className="glass-card p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-accent/5 to-transparent">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Semantic Search Latency</span>
                    <span className="text-4xl font-black text-accent tracking-tighter">{data.memory.avgSearchLatency.toFixed(1)}ms</span>
                </div>
            </footer>
        </div>
    );
};

export default LearningDashboard;
