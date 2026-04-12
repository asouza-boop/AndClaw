import React from 'react';
import { Play, Pause, FastForward, Info } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';

export function ExecutionHUD() {
  const { isPaused, currentTrace, currentRequestId, setPaused, uiMode } = useAgentStore();

  if (!currentRequestId && !currentTrace) return null;

  const lastStep = currentTrace?.steps[currentTrace.steps.length - 1];
  const isRunning = lastStep && !['success', 'failure', 'blocked'].includes(lastStep.status);

  const togglePause = async () => {
    try {
      const endpoint = isPaused ? '/api/resume' : '/api/pause';
      // Note: agent-routes are mounted on /api, so /api/agent/pause
      await apiFetch(`/api/agent${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ requestId: currentRequestId }),
      });
      setPaused(!isPaused);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4">
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
        <div className="px-4 py-3 bg-primary/5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-primary animate-pulse' : 'bg-muted'} shadow-[0_0_8px_rgba(var(--primary),0.5)]`} />
            <span className="text-xs font-medium text-foreground capitalize">
              {lastStep?.type.replace('agent.', '').replace('.', ' ') || 'Iniciando...'}
            </span>
          </div>
          <div className="flex items-center gap-1">
             <button 
              onClick={togglePause}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
              title={isPaused ? "Retomar" : "Pausar"}
             >
               {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
             </button>
             <button className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors" title="Pular Etapa">
               <FastForward className="w-4 h-4" />
             </button>
          </div>
        </div>

        {uiMode === 'debug' && (
          <div className="px-4 py-3 bg-black/20 text-[10px] font-mono whitespace-nowrap overflow-hidden text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Info className="w-3 h-3" />
            <span>Trace ID: {currentRequestId || 'HISTÓRICO'}</span>
            <span className="ml-auto opacity-50">v1.glass_engine</span>
          </div>
        )}
      </div>
    </div>
  );
}
