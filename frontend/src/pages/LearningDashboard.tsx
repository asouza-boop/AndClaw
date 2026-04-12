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
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return <div>Erro ao carregar métricas de inteligência.</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight">System Intelligence</h1>
                    <p className="text-white/50">Métricas de aprendizado e evolução do sistema AndClaw.</p>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 text-xs text-white/60">
                    Sugerido: <span className="text-blue-400 font-bold">Variante {data.planner.suggestedWinner}</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <EfficiencyMetricCard 
                    title="Economia Estimada"
                    value={`+${data.cache.efficiency.toFixed(0)}s`}
                    subtitle="Tempo poupado via Cache"
                    trend="up"
                />
                <EfficiencyMetricCard 
                    title="Taxa de Acerto (Cache)"
                    value={`${(data.cache.hitRate * 100).toFixed(1)}%`}
                    subtitle={`${data.cache.hitCount} hits detectados`}
                    trend="neutral"
                />
                <EfficiencyMetricCard 
                    title="Volume de Memória"
                    value={data.memory.totalRecords}
                    subtitle="Itens semânticos persistidos"
                    trend="up"
                />
                <EfficiencyMetricCard 
                    title="Fallback Rate"
                    value={`${(data.planner.fallbackRate * 100).toFixed(1)}%`}
                    subtitle="Aderência ao plano original"
                    trend={data.planner.fallbackRate < 0.2 ? 'down' : 'up'}
                />
            </div>

            <IntelligenceInsights insights={data.insights} />

            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-white px-2">Skill Intelligence</h2>
                <SkillPerformanceChart top={data.skills.top} worst={data.skills.worst} />
            </section>

            <footer className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4 border border-white/5 rounded-xl text-center">
                    <span className="block text-xs text-white/40 uppercase mb-1">Melhoria de Performance (A/B)</span>
                    <span className="text-2xl font-black text-blue-400">{data.planner.improvement}</span>
                </div>
                <div className="glass-card p-4 border border-white/5 rounded-xl text-center">
                    <span className="block text-xs text-white/40 uppercase mb-1">Média de Latência de Busca</span>
                    <span className="text-2xl font-black text-purple-400">{data.memory.avgSearchLatency.toFixed(1)}ms</span>
                </div>
            </footer>
        </div>
    );
};

export default LearningDashboard;
