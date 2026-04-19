import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Zap, Target, AlertCircle, Sparkles, RefreshCcw, ChevronRight } from 'lucide-react';
import * as Typography from "@/components/ui/Typography";

interface BriefingContent {
  focus: string;
  actions: string[];
  risks: string[];
  quick_wins: string[];
}

export const DailyBriefing: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['daily-briefing'],
    queryFn: () => apiFetch<{ok: boolean, briefing: BriefingContent}>('/api/daily-briefing').then(r => r.briefing)
  });

  const generateMutation = useMutation({
    mutationFn: () => apiFetch('/api/daily-briefing/generate', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-briefing'] })
  });

  if (isLoading) return (
    <div className="glass-card p-8 animate-pulse flex flex-col items-center justify-center min-h-[300px]">
      <Sparkles className="w-8 h-8 text-primary/40 mb-4 animate-spin" />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Synthesizing Daily Intelligence...</span>
    </div>
  );

  if (error || !data) return null;

  return (
    <div className="glass-card overflow-hidden group relative transition-premium hover:border-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
      
      <div className="p-8 relative z-10">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <Typography.Title className="text-xl font-black text-white tracking-tighter">Daily Copilot</Typography.Title>
              <Typography.Label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Strategic Executive Summary</Typography.Label>
            </div>
          </div>
          <button 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all outline-none"
            title="Sincronizar Manualmente"
          >
            <RefreshCcw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <section className="mb-8 p-6 rounded-2xl bg-white/[0.03] border border-white/5 relative overflow-hidden group/focus transition-premium hover:bg-white/[0.05]">
           <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/focus:opacity-30 transition-opacity">
              <Target className="w-12 h-12 text-primary" />
           </div>
           <Typography.Label className="text-[9px] font-black text-primary uppercase tracking-widest mb-2 block">Focus do Dia</Typography.Label>
           <Typography.Title className="text-xl font-bold text-white leading-tight tracking-tight">
              {data.focus}
           </Typography.Title>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Actions */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-accent" />
              Ações Sugeridas
            </h4>
            <div className="grid gap-2">
              {data.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-premium group/item">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent/40 group-hover/item:bg-accent shadow-[0_0_5px_rgba(var(--accent-rgb),0.5)] transition-premium" />
                  <span className="text-xs text-white/70 font-medium leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risks & Wins */}
          <div className="space-y-6">
             <div className="space-y-3">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500/50 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Riscos & Gargalos
               </h4>
               <div className="grid gap-2">
                 {data.risks.map((risk, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-[11px] text-rose-200/60 font-medium">
                      {risk}
                    </div>
                 ))}
                 {data.risks.length === 0 && <p className="text-[10px] text-white/10 italic">Nenhum risco detectado.</p>}
               </div>
             </div>

             <div className="space-y-3">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500/50 flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Quick Wins
               </h4>
               <div className="grid gap-2">
                 {data.quick_wins.map((win, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-200/60 font-medium">
                      {win}
                    </div>
                 ))}
               </div>
             </div>
          </div>
        </div>

        <footer className="mt-8 pt-8 border-t border-white/5">
           <button className="w-full py-4 rounded-xl bg-white text-black text-xs font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-premium flex items-center justify-center gap-2 shadow-xl interactive-scale active:scale-95">
              Iniciar Meu Dia
              <ChevronRight className="w-4 h-4 ml-1" />
           </button>
        </footer>
      </div>
    </div>
  );
};
