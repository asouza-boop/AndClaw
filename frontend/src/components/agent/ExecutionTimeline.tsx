import React from 'react';
import { Activity } from 'lucide-react';

export interface TraceStep {
  type: string;
  status?: string;
  timestamp: string | number;
  data?: any;
}

interface ExecutionTimelineProps {
  steps: TraceStep[];
  title?: string;
  emptyMessage?: string;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ 
  steps, 
  title = "Raciocínio de Fluxo",
  emptyMessage = "Aguardando decisões do planner..."
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        <Activity className="w-3 h-3" />
        {title}
      </h3>
      {steps.length === 0 && (
        <div className="text-xs text-muted-foreground italic p-4 text-center border border-dashed border-white/5 rounded-lg">
          {emptyMessage}
        </div>
      )}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface-2 border border-white/5 space-y-2 group hover:border-primary/20 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-primary font-bold">{step.type.split('.').pop()?.toUpperCase()}</span>
              <span className="text-[9px] text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</span>
            </div>
            {step.data && (
              <pre className="text-[10px] text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap bg-black/20 p-2 rounded border border-white/5">
                {JSON.stringify(step.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
