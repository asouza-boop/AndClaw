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
  title = "Intelligence Flow",
  emptyMessage = "Waiting for cognitive trace..."
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
        <Activity className="w-3 h-3 text-primary animate-pulse" />
        {title}
      </h3>
      {steps.length === 0 && (
        <div className="text-[11px] text-white/20 italic p-8 text-center border border-dashed border-white/5 rounded-2xl animate-in fade-in duration-700">
          {emptyMessage}
        </div>
      )}
      <div className="space-y-0 relative pl-4">
        {/* Connection Line */}
        {steps.length > 1 && (
          <div className="absolute left-[1.375rem] top-4 bottom-4 w-[1px] bg-gradient-to-b from-primary/40 via-accent/20 to-transparent" />
        )}

        {steps.map((step, i) => (
          <div key={i} className="relative pb-8 last:pb-0 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="absolute left-[-0.375rem] top-1.5 w-3 h-3 rounded-full bg-bg-deep border-2 border-primary shadow-[0_0_10px_rgba(168,85,247,0.5)] z-10" />
            
            <div className="glass-card-v2 p-4 space-y-3 group">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black font-mono text-primary uppercase tracking-widest">{step.type.split('.').pop()}</span>
                <span className="text-[9px] font-black text-white/20 tracking-widest">{new Date(step.timestamp).toLocaleTimeString()}</span>
              </div>
              {step.data && (
                <pre className="text-[11px] text-white/60 leading-relaxed font-mono whitespace-pre-wrap bg-black/40 p-3 rounded-xl border border-white/5 group-hover:border-primary/20 transition-premium">
                  {typeof step.data === 'string' ? step.data : JSON.stringify(step.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
