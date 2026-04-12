import React, { useState } from 'react';
import { Brain, Database, Shield, X, HelpCircle, Activity, Zap } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';

export function IntelligenceSidebar() {
  const [activeTab, setActiveTab] = useState<'why' | 'memory' | 'security'>('why');
  const { currentTrace, uiMode } = useAgentStore();

  if (uiMode !== 'debug') return null;

  const steps = currentTrace?.steps || [];
  
  const reasoningSteps = steps.filter(s => ['agent.intent.detected', 'agent.plan.created', 'agent.control.paused'].includes(s.type));
  const memorySteps = steps.filter(s => ['agent.cache.hit', 'agent.cache.miss', 'agent.memory.used'].includes(s.type));
  const securitySteps = steps.filter(s => ['agent.security.blocked', 'agent.spec.violation'].includes(s.type));

  const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex flex-col items-center gap-1 py-3 border-b-2 transition-all ${
        activeTab === id 
          ? 'border-primary text-primary bg-primary/5' 
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="w-80 h-full border-l border-white/5 bg-black/20 backdrop-blur-md flex flex-col animate-in slide-in-from-right">
      <div className="flex border-b border-white/5">
        <TabButton id="why" icon={Brain} label="Why" />
        <TabButton id="memory" icon={Database} label="Memory" />
        <TabButton id="security" icon={Shield} label="Security" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'why' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Raciocínio de Fluxo
            </h3>
            {reasoningSteps.length === 0 && (
              <div className="text-xs text-muted-foreground italic p-4 text-center border border-dashed border-white/5 rounded-lg">
                Aguardando decisões do planner...
              </div>
            )}
            {reasoningSteps.map((step, i) => (
              <div key={i} className="p-3 rounded-lg bg-surface-2 border border-white/5 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono text-primary font-bold">{step.type.split('.').pop()?.toUpperCase()}</span>
                  <span className="text-[9px] text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</span>
                </div>
                {step.data && (
                  <pre className="text-[10px] text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap bg-black/20 p-2 rounded">
                    {JSON.stringify(step.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Database className="w-3 h-3" />
              Contexto Semântico
            </h3>
            {memorySteps.map((step, i) => (
              <div key={i} className={`p-3 rounded-lg border border-white/5 ${step.status === 'hit' ? 'bg-success/5 border-success/20' : 'bg-surface-2'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-bold ${step.status === 'hit' ? 'text-success' : 'text-warn'}`}>
                    {step.status === 'hit' ? 'CACHE HIT' : 'CACHE MISS'}
                  </span>
                  {step.data?.similarity && (
                    <span className="text-[9px] px-1.5 rounded bg-white/5">Score: {(step.data.similarity * 100).toFixed(1)}%</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  Busca vetorial completada para o input do usuário.
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Governança & Segurança
            </h3>
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-[10px] text-success font-medium">Lâmina de Segurança Ativa</p>
              <p className="text-[9px] text-muted-foreground mt-1 text-justify">
                Monitoramento de injeção de prompt e conformidade com a Constituição v1.0 habilitado.
              </p>
            </div>
            {securitySteps.map((step, i) => (
              <div key={i} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-[10px] font-bold text-destructive uppercase tracking-tighter">VIOLAÇÃO DETECTADA</span>
                <p className="text-[10px] text-foreground/90 mt-1">{step.data?.reason || 'Acesso negado por política externa.'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-white/5 bg-black/40 space-y-3">
        <a 
          href="/evolucao"
          className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase">Ver Evolução do Motor</span>
          </div>
          <Zap className="w-3 h-3 text-primary group-hover:translate-x-0.5 transition-transform" />
        </a>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
          <HelpCircle className="w-3 h-3" />
          <span>Explainability Mode Ativo</span>
        </div>
      </div>
    </div>
  );
}
