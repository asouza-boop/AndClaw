import React, { useMemo } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Clock3,
  PlayCircle,
  Route,
  Sparkles,
  Workflow,
  AlertTriangle,
  Zap,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agentStore';

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

type StageKey = 'intent' | 'plan' | 'execution' | 'result';

const stageOrder: StageKey[] = ['intent', 'plan', 'execution', 'result'];

const stageMeta: Record<StageKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  intent: { label: 'Intent', icon: BrainCircuit },
  plan: { label: 'Plan', icon: Route },
  execution: { label: 'Execution', icon: PlayCircle },
  result: { label: 'Result', icon: CheckCircle2 },
};

function toStage(stepType: string): StageKey {
  const type = (stepType || '').toLowerCase();

  if (type.includes('intent')) return 'intent';
  if (type.includes('plan')) return 'plan';
  if (type.includes('result') || type.includes('complete') || type.includes('reply')) return 'result';
  if (type.includes('skill') || type.includes('tool') || type.includes('execution') || type.includes('run')) {
    return 'execution';
  }

  return 'execution';
}

function formatLabel(type: string) {
  const raw = (type || '').split('.').pop() || type;
  return raw
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(ts: string | number) {
  if (!ts) return '';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  steps,
  title = 'Execution timeline',
  emptyMessage = 'Waiting for cognitive trace...',
}) => {
  const { featureFlags } = useAgentStore();
  const safeSteps = useMemo(() => Array.isArray(steps) ? steps : [], [steps]);

  const grouped = useMemo(
    () =>
      stageOrder.map((stage) => ({
        stage,
        steps: safeSteps.filter((step) => toStage(step?.type || '') === stage),
      })),
    [safeSteps],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Trace</p>
          <h3 className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Workflow className="h-4 w-4 text-primary" />
            {title}
          </h3>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {safeSteps.length > 0 ? `${safeSteps.length} steps` : 'Idle'}
        </div>
      </div>

      {safeSteps.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-8 text-center text-sm text-muted-foreground animate-in fade-in duration-300">
          {emptyMessage}
        </div>
      ) : (
        <div className="relative space-y-4 pl-1">
          <div className="absolute left-[1.15rem] top-3 bottom-3 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />

          {grouped.map((group, index) => {
            const meta = stageMeta[group.stage];
            const active = group.steps.length > 0;
            const Icon = meta.icon;

            return (
              <section
                key={group.stage}
                className="relative animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex gap-4">
                  <div className="relative flex w-10 justify-center">
                    <div
                      className={cn(
                        'mt-4 h-3 w-3 rounded-full border',
                        active ? 'border-primary bg-primary shadow-[0_0_0_8px_rgba(168,85,247,0.12)]' : 'border-white/[0.12] bg-white/[0.04]',
                      )}
                    />
                    {active && (
                      <div className="absolute top-3 h-5 w-5 rounded-full border border-primary/30 bg-primary/10 animate-pulse" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'rounded-[22px] border p-4 backdrop-blur-xl transition-all duration-200',
                        active
                          ? 'border-primary/15 bg-primary/[0.06] shadow-[0_18px_50px_-34px_rgba(168,85,247,0.35)]'
                          : 'border-white/[0.08] bg-white/[0.03]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-xl border',
                              active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p
                              className={cn(
                                'text-[10px] font-semibold uppercase tracking-[0.22em]',
                                active ? 'text-primary' : 'text-muted-foreground',
                              )}
                            >
                              {meta.label}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {active ? `${group.steps.length} event${group.steps.length > 1 ? 's' : ''}` : 'No events yet'}
                            </p>
                          </div>
                        </div>

                        <CircleDashed className={cn('h-4 w-4', active ? 'text-primary/60' : 'text-muted-foreground/50')} />
                      </div>

                      {active ? (
                        <div className="mt-4 space-y-3">
                          {group.steps.map((step, stepIndex) => {
                            const isFallback = step.type.includes('fallback');
                            const isBlock = step.type.includes('blocked');
                            const isCacheHit = step.status === 'hit';

                            return (
                              <article
                                key={`${step.type}-${stepIndex}`}
                                className="rounded-2xl border border-white/[0.07] bg-surface/45 px-4 py-3 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300"
                                style={{ animationDelay: `${index * 90 + stepIndex * 70}ms` }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-foreground/90">
                                        {formatLabel(step.type)}
                                      </p>
                                      
                                      {/* Enhanced UI Trace Badges */}
                                      {featureFlags.UI_TRACE_ENHANCED && isFallback && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warn/10 text-warn border border-warn/20 text-[8px] font-black uppercase tracking-widest">
                                          <AlertTriangle className="w-2.5 h-2.5" /> Fallback Used
                                        </span>
                                      )}
                                      {featureFlags.UI_TRACE_ENHANCED && isBlock && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] font-black uppercase tracking-widest">
                                          <ShieldAlert className="w-2.5 h-2.5" /> Security Block
                                        </span>
                                      )}
                                      {featureFlags.UI_TRACE_ENHANCED && isCacheHit && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20 text-[8px] font-black uppercase tracking-widest">
                                          <Zap className="w-2.5 h-2.5" /> Cache Hit
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                                      {step.status || 'pending'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {formatTime(step.timestamp)}
                                  </div>
                                </div>

                                {/* Decision Visibility */}
                                {featureFlags.UI_TRACE_ENHANCED && step.data?.reason && (
                                  <div className="mt-2.5 mb-1 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                                    <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-1">Planner Reasoning</p>
                                    <p className="text-xs text-white/80 leading-relaxed">{step.data.reason}</p>
                                  </div>
                                )}
                                {featureFlags.UI_TRACE_ENHANCED && step.data?.decision && (
                                  <div className="mt-2.5 mb-1 px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
                                    <p className="text-[10px] font-black text-accent/70 uppercase tracking-widest mb-1">Optimized Decision</p>
                                    <p className="text-xs text-white/80 leading-relaxed">{step.data.decision}</p>
                                  </div>
                                )}

                                {step.data && (
                                  <pre className="mt-3 overflow-hidden text-[11px] leading-5 text-muted-foreground whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-black/20 p-3">
                                    {typeof step.data === 'string' ? step.data : JSON.stringify(step.data, null, 2)}
                                  </pre>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.02] px-4 py-4 text-sm text-muted-foreground">
                          {emptyMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

