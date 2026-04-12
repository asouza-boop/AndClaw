import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { TrendingUp, Clock, CheckCircle2, Zap, BarChart3, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EvolutionDashboard() {
  const { data: scores, isLoading } = useQuery({
    queryKey: ['learning-performance'],
    queryFn: () => apiFetch<any>('/api/learning/performance').then(res => ensureArray(res.items)),
    refetchInterval: 10000 // Refresh every 10s
  });

  return (
    <div className="p-6 space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/chat" className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Evolução do Motor</h1>
            <p className="text-sm text-muted-foreground">Otimização passiva de habilidades baseada em performance real.</p>
          </div>
        </div>
        
        <div className="px-4 py-2 glass-panel rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Otimizador Ativo (Safe Mode)</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : scores?.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground">Ainda não há dados de performance coletados.</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Execute o agente para começar a treinar o motor de otimização.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scores?.map((skill: any) => (
            <div key={skill.skillId} className="glass-panel p-5 rounded-2xl hover:scale-[1.02] transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{skill.skillId}</h3>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Habilidade Ativa</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-black text-primary">{skill.score}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Skill Score</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    <span className="text-[10px] uppercase font-medium">Sucesso</span>
                  </div>
                  <p className="text-sm font-bold">{(skill.successRate * 100).toFixed(1)}%</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3 text-warn" />
                    <span className="text-[10px] uppercase font-medium">Latência</span>
                  </div>
                  <p className="text-sm font-bold">{Math.round(skill.avgLatencyMs)}ms</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-[10px] uppercase font-medium">Uso Real</span>
                  </div>
                  <p className="text-sm font-bold">{skill.usageCount} exec</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BarChart3 className="w-3 h-3 text-accent" />
                    <span className="text-[10px] uppercase font-medium">Status</span>
                  </div>
                  <p className="text-[10px] font-bold text-success uppercase">Otimizado</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000" 
                    style={{ width: `${skill.score}%` }}
                   />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] text-muted-foreground">Última computação</span>
                  <span className="text-[9px] text-muted-foreground">{new Date(skill.lastComputed).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
