import React, { useMemo } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { Brain, Cpu, Sparkles, Activity, CheckCircle, AlertTriangle, Search, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const statusMap: Record<string, { label: string; icon: any; color: string }> = {
  'agent.run.start': { label: 'AndClaw está acordando...', icon: Sparkles, color: 'text-primary' },
  'agent.classification.result': { label: 'Analisando contexto...', icon: Search, color: 'text-accent' },
  'agent.intent.detected': { label: 'Intenção identificada', icon: Lightbulb, color: 'text-success' },
  'agent.plan.created': { label: 'Montando estratégia...', icon: Cpu, color: 'text-primary' },
  'agent.cache.hit': { label: 'Resposta rápida via cache', icon: Activity, color: 'text-accent' },
  'agent.run.complete': { label: 'Pronto!', icon: CheckCircle, color: 'text-success' },
  'agent.security.blocked': { label: 'Ação bloqueada por segurança', icon: AlertTriangle, color: 'text-destructive' },
};

export function AgentPresence() {
  const { currentTrace, featureFlags } = useAgentStore();

  const lastStep = useMemo(() => {
    if (!currentTrace || !currentTrace.steps.length) return null;
    return currentTrace.steps[currentTrace.steps.length - 1];
  }, [currentTrace]);

  const isActive = useMemo(() => {
    if (!lastStep) return false;
    return lastStep.type !== 'agent.run.complete' && lastStep.status !== 'success' && lastStep.status !== 'failure';
  }, [lastStep]);

  if (!featureFlags.AGENT_PRESENCE || !lastStep) return null;

  const info = statusMap[lastStep.type] || { label: 'Pensando...', icon: Brain, color: 'text-primary' };
  const Icon = info.icon;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center gap-3 px-4 py-2 rounded-full bg-surface/40 backdrop-blur-md border border-white/5 shadow-lg shadow-black/20"
      >
        <div className="relative">
          {isActive && (
            <motion.div 
              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`absolute inset-0 rounded-full blur-md ${info.color} bg-current`}
            />
          )}
          <Icon className={`w-4 h-4 ${info.color} relative z-10 ${isActive ? 'animate-pulse' : ''}`} />
        </div>
        
        <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">AndClaw Agent</span>
            <span className="text-xs font-medium text-foreground min-w-[140px]">
              {info.label}
            </span>
        </div>

        {isActive && (
           <div className="flex gap-1 ml-2">
             {[0, 1, 2].map(i => (
               <motion.div 
                 key={i}
                 animate={{ opacity: [0.3, 1, 0.3] }}
                 transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                 className="w-1 h-1 rounded-full bg-primary"
               />
             ))}
           </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
