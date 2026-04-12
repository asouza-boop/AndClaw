import React, { useState } from 'react';
import { Brain, Database, Shield, HelpCircle, Activity, Zap } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { ExecutionTimeline, TraceStep } from './ExecutionTimeline';

export function IntelligenceSidebar() {
  const [activeTab, setActiveTab] = useState<'why' | 'memory' | 'security'>('why');
  const { currentTrace } = useAgentStore();

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
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex border-b border-white/5">
        <TabButton id="why" icon={Brain} label="Why" />
        <TabButton id="memory" icon={Database} label="Memory" />
        <TabButton id="security" icon={Shield} label="Security" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'why' && (
          <ExecutionTimeline 
            steps={reasoningSteps as TraceStep[]} 
            title="Reasoning Flow"
            emptyMessage="Waiting for planner decisions..."
          />
        )}

        {activeTab === 'memory' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Database className="w-3 h-3" />
              Semantic Context
            </h3>
            <div className="space-y-3">
              {memorySteps.map((step, i) => (
                <div key={i} className={`p-3 rounded-lg border border-white/5 ${step.status === 'hit' ? 'bg-success/5 border-success/20' : 'bg-surface-2'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-bold ${step.status === 'hit' ? 'text-emerald-400' : 'text-warn'}`}>
                      {step.status === 'hit' ? 'CACHE HIT' : 'CACHE MISS'}
                    </span>
                    {step.data?.similarity && (
                      <span className="text-[9px] px-1.5 rounded bg-white/5">Score: {(step.data.similarity * 100).toFixed(1)}%</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                    Vector search completed for user intent.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Governance & Security
            </h3>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active Security Layer</p>
              <p className="text-[9px] text-white/40 mt-1 leading-relaxed">
                Prompt injection monitoring and Constitution v1.0 enforcement enabled.
              </p>
            </div>
            {securitySteps.map((step, i) => (
              <div key={i} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-[10px] font-bold text-destructive uppercase tracking-tighter">VIOLAÇÃO DETECTADA</span>
                <p className="text-[10px] text-foreground/90 mt-1">{step.data?.reason || 'Access denied by external policy.'}</p>
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
            <span className="text-[10px] font-bold text-primary uppercase">Engine Evolution</span>
          </div>
          <Zap className="w-3 h-3 text-primary group-hover:translate-x-0.5 transition-transform" />
        </a>
        <div className="flex items-center gap-2 text-[10px] text-white/20 px-1 font-bold">
          <HelpCircle className="w-3 h-3" />
          <span>EXPLAINABILITY MODE ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
