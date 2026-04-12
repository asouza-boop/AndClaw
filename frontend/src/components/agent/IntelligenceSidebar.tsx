import React, { useState } from 'react';
import { Brain, Database, Shield, Activity, Zap } from 'lucide-react';
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
      className={`flex-1 flex flex-col items-center gap-2 py-4 transition-premium relative ${
        activeTab === id 
          ? 'text-primary' 
          : 'text-white/30 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
      {activeTab === id && (
        <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary shadow-[0_0_10px_rgba(168,85,247,0.5)] rounded-full" />
      )}
    </button>
  );

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-700 font-outfit">
      <div className="flex bg-black/40 border-b border-white/5">
        <TabButton id="why" icon={Brain} label="WHY" />
        <TabButton id="memory" icon={Database} label="MEMORY" />
        <TabButton id="security" icon={Shield} label="SECURITY" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        {activeTab === 'why' && (
          <ExecutionTimeline 
            steps={reasoningSteps as TraceStep[]} 
            title="Reasoning Flux"
            emptyMessage="Waiting for engine logic..."
          />
        )}

        {activeTab === 'memory' && (
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
              <Database className="w-3 h-3 text-accent" />
              Semantic Map
            </h3>
            <div className="space-y-4">
              {memorySteps.map((step, i) => (
                <div key={i} className={`glass-card-v2 p-5 ${step.status === 'hit' ? 'border-accent/30 bg-accent/5' : ''}`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[10px] font-black tracking-widest uppercase ${step.status === 'hit' ? 'text-accent' : 'text-white/40'}`}>
                      {step.status === 'hit' ? 'CACHE MATCH' : 'COLD FETCH'}
                    </span>
                    {step.data?.similarity && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/40">SIM: {(step.data.similarity * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed italic">
                    Vector analysis identified relevant context for user directive.
                  </p>
                </div>
              ))}
              {memorySteps.length === 0 && (
                <div className="text-[11px] text-white/20 italic p-8 text-center border border-dashed border-white/5 rounded-2xl">
                  No semantic context utilized.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
              <Shield className="w-3 h-3 text-rose-500" />
              Governance Deck
            </h3>
            <div className="glass-card-v2 p-5 bg-emerald-500/5 border-emerald-500/20">
              <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Active Constitution</p>
              <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                Prompt injection monitoring and recursive policy enforcement initialized.
              </p>
            </div>
            {securitySteps.length === 0 && (
              <div className="text-[11px] text-emerald-400/40 italic p-8 text-center border border-dashed border-emerald-500/10 rounded-2xl">
                No policy violations detected.
              </div>
            )}
            {securitySteps.map((step, i) => (
              <div key={i} className="glass-card-v2 p-5 bg-rose-500/10 border-rose-500/20">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">THREAT DETECTED</span>
                <p className="text-[11px] text-white/80 mt-2 leading-relaxed">{step.data?.reason || 'Access denied by governance policy.'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-6 border-t border-white/5 bg-black/60 space-y-4">
        <a 
          href="/evolucao"
          className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-premium group interactive-scale"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-[11px] font-black text-primary uppercase tracking-widest">Engine Metrics</span>
          </div>
          <Zap className="w-4 h-4 text-primary group-hover:translate-x-1 transition-premium" />
        </a>
        <div className="flex items-center justify-center gap-2 text-[10px] text-white/10 font-black uppercase tracking-[0.3em] py-2">
          <span>Explainability Mode v1.0</span>
        </div>
      </div>
    </div>
  );
}
