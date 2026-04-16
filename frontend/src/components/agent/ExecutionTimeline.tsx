import React, { useMemo } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Route,
  Sparkles,
  Workflow,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Timer,
  Wrench,
  CircleCheck,
  CircleX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agentStore';
import { Badge } from '@/components/ui/badge';
import { Stack } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Label, Caption } from '@/components/ui/Typography';

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

type StageKey = 'analysis' | 'planning' | 'execution' | 'result';

const stageOrder: StageKey[] = ['analysis', 'planning', 'execution', 'result'];

const stageMeta: Record<StageKey, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  analysis: { label: 'Analysis', description: 'Understanding intent and context', icon: BrainCircuit },
  planning: { label: 'Planning', description: 'Selecting skills and building strategy', icon: Route },
  execution: { label: 'Execution', description: 'Running tools and processing data', icon: PlayCircle },
  result: { label: 'Result', description: 'Delivering the final output', icon: CheckCircle2 },
};

function toStage(stepType: string): StageKey {
  const type = (stepType || '').toLowerCase();

  if (type.includes('intent') || type.includes('detect') || type.includes('context')) return 'analysis';
  if (type.includes('plan') || type.includes('skill.selected') || type.includes('route')) return 'planning';
  if (type.includes('result') || type.includes('complete') || type.includes('reply') || type.includes('response')) return 'result';
  if (type.includes('skill') || type.includes('tool') || type.includes('execution') || type.includes('run') || type.includes('memory') || type.includes('cache')) {
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
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStepIcon(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('intent') || t.includes('detect')) return BrainCircuit;
  if (t.includes('plan') || t.includes('route')) return Route;
  if (t.includes('skill') || t.includes('tool')) return Wrench;
  if (t.includes('cache') || t.includes('memory')) return Zap;
  if (t.includes('security') || t.includes('blocked')) return ShieldAlert;
  if (t.includes('fallback')) return AlertTriangle;
  if (t.includes('result') || t.includes('complete')) return Sparkles;
  return Workflow;
}

function computeLatency(steps: TraceStep[]): string | null {
  if (steps.length < 2) return null;
  const first = new Date(steps[0]?.timestamp);
  const last = new Date(steps[steps.length - 1]?.timestamp);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return null;
  const ms = last.getTime() - first.getTime();
  if (ms < 0) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function extractResultInfo(steps: TraceStep[]) {
  const resultStep = [...steps].reverse().find(s => toStage(s?.type || '') === 'result');
  const skillStep = [...steps].reverse().find(s => (s?.type || '').toLowerCase().includes('skill'));
  
  return {
    success: resultStep ? (resultStep.status !== 'error' && resultStep.status !== 'failed') : null,
    tool: skillStep?.data?.skill || skillStep?.data?.tool || skillStep?.data?.name || null,
  };
}

type StepBadgeInfo = { variant: "cached" | "fallback" | "error" | "optimizing" | "glass"; label: string } | null;

function getStepBadge(step: TraceStep): StepBadgeInfo {
  const type = (step.type || '').toLowerCase();
  if (type.includes('fallback')) return { variant: 'fallback', label: 'Fallback' };
  if (type.includes('blocked') || type.includes('security')) return { variant: 'error', label: 'Blocked' };
  if (step.status === 'hit') return { variant: 'cached', label: 'Cache Hit' };
  if (type.includes('optimiz')) return { variant: 'optimizing', label: 'Optimized' };
  if (step.status === 'retry') return { variant: 'glass', label: 'Retry' };
  return null;
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

  const latency = useMemo(() => computeLatency(safeSteps), [safeSteps]);
  const resultInfo = useMemo(() => extractResultInfo(safeSteps), [safeSteps]);

  // Determine which stages are completed, active, or pending
  const stageStates = useMemo(() => {
    const states: Record<StageKey, 'completed' | 'active' | 'pending'> = {
      analysis: 'pending',
      planning: 'pending',
      execution: 'pending',
      result: 'pending',
    };

    let lastActiveIndex = -1;
    stageOrder.forEach((stage, i) => {
      const group = grouped.find(g => g.stage === stage);
      if (group && group.steps.length > 0) {
        lastActiveIndex = i;
      }
    });

    stageOrder.forEach((stage, i) => {
      const group = grouped.find(g => g.stage === stage);
      if (!group || group.steps.length === 0) {
        states[stage] = 'pending';
      } else if (i < lastActiveIndex) {
        states[stage] = 'completed';
      } else {
        states[stage] = 'active';
      }
    });

    return states;
  }, [grouped]);

  if (safeSteps.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No trace available"
        description={emptyMessage}
        className="py-12"
      />
    );
  }

  return (
    <Stack className="gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <Caption>Trace</Caption>
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {latency && (
            <Badge variant="glass" className="text-[8px] gap-1">
              <Timer className="h-3 w-3" />
              {latency}
            </Badge>
          )}
          <Badge variant="glass" className="text-[8px]">
            {safeSteps.length} step{safeSteps.length > 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-1">
        {/* Vertical connector line */}
        <div className="absolute left-[1.15rem] top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-primary/15 to-transparent" />

        <Stack className="gap-0">
          {grouped.map((group, groupIndex) => {
            const meta = stageMeta[group.stage];
            const state = stageStates[group.stage];
            const hasSteps = group.steps.length > 0;
            const StageIcon = meta.icon;

            return (
              <section
                key={group.stage}
                className="relative animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${groupIndex * 100}ms` }}
              >
                <div className="flex gap-4 pb-6">
                  {/* Node */}
                  <div className="relative flex w-10 justify-center pt-1 shrink-0">
                    <div
                      className={cn(
                        'relative z-10 h-3.5 w-3.5 rounded-full border-2 transition-all duration-500',
                        state === 'completed' && 'border-primary bg-primary shadow-[0_0_8px_rgba(168,85,247,0.3)]',
                        state === 'active' && 'border-primary bg-primary shadow-[0_0_12px_rgba(168,85,247,0.4)]',
                        state === 'pending' && 'border-white/15 bg-white/5',
                      )}
                    />
                    {state === 'active' && (
                      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-primary/20 animate-ping" />
                    )}
                    {state === 'completed' && (
                      <CircleCheck className="absolute -top-0.5 -left-0.5 h-4.5 w-4.5 text-primary opacity-0" />
                    )}
                  </div>

                  {/* Stage Content */}
                  <div className="min-w-0 flex-1">
                    {/* Stage Header */}
                    <div
                      className={cn(
                        'rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300',
                        state === 'active' && 'border-primary/15 bg-primary/[0.06] shadow-[0_16px_48px_-32px_rgba(168,85,247,0.35)]',
                        state === 'completed' && 'border-white/[0.1] bg-white/[0.04]',
                        state === 'pending' && 'border-white/[0.05] bg-white/[0.02] opacity-50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-xl border transition-colors duration-300',
                              state === 'active' && 'border-primary/20 bg-primary/10 text-primary',
                              state === 'completed' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
                              state === 'pending' && 'border-white/[0.08] bg-white/[0.03] text-muted-foreground',
                            )}
                          >
                            {state === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <StageIcon className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <Label className={cn(
                              state === 'active' && 'text-primary',
                              state === 'completed' && 'text-foreground/80',
                              state === 'pending' && 'text-muted-foreground',
                            )}>
                              {meta.label}
                            </Label>
                            <Caption as="p" className="mt-0.5">
                              {hasSteps ? meta.description : 'Waiting...'}
                            </Caption>
                          </div>
                        </div>

                        {hasSteps && (
                          <Badge
                            variant={state === 'completed' ? 'success' : state === 'active' ? 'optimizing' : 'glass'}
                            className="text-[8px]"
                          >
                            {group.steps.length} event{group.steps.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {/* Steps */}
                      {hasSteps && (
                        <Stack className="mt-4 gap-2.5">
                          {group.steps.map((step, stepIndex) => {
                            const StepIcon = getStepIcon(step.type);
                            const badge = getStepBadge(step);
                            const isLast = groupIndex === grouped.length - 1 && stepIndex === group.steps.length - 1;

                            return (
                              <article
                                key={`${step.type}-${stepIndex}`}
                                className={cn(
                                  'group rounded-xl border border-white/[0.07] bg-surface/45 px-4 py-3 transition-all duration-300 hover:border-white/[0.12] hover:bg-surface/60',
                                  isLast && state === 'active' && 'ring-1 ring-primary/10',
                                )}
                                style={{ animationDelay: `${groupIndex * 100 + stepIndex * 60}ms` }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className={cn(
                                      'mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg shrink-0',
                                      state === 'active' ? 'bg-primary/10 text-primary' : 'bg-white/5 text-muted-foreground',
                                    )}>
                                      <StepIcon className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Label className="text-foreground/90 text-[10px]">
                                          {formatLabel(step.type)}
                                        </Label>
                                        {badge && (
                                          <Badge variant={badge.variant} className="text-[7px] px-1.5 py-0">
                                            {badge.label}
                                          </Badge>
                                        )}
                                      </div>
                                      <Caption as="p" className="mt-0.5">
                                        {step.status || 'processed'}
                                      </Caption>
                                    </div>
                                  </div>
                                  <Caption className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                                    <Clock3 className="h-3 w-3" />
                                    {formatTime(step.timestamp)}
                                  </Caption>
                                </div>

                                {/* Reasoning Block */}
                                {step.data?.reason && (
                                  <div className="mt-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                                    <Caption className="text-primary/70 mb-1">Reasoning</Caption>
                                    <p className="text-xs text-white/80 leading-relaxed">{String(step.data.reason)}</p>
                                  </div>
                                )}

                                {/* Decision Block */}
                                {step.data?.decision && (
                                  <div className="mt-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
                                    <Caption className="text-accent/70 mb-1">Decision</Caption>
                                    <p className="text-xs text-white/80 leading-relaxed">{String(step.data.decision)}</p>
                                  </div>
                                )}

                                {/* Raw Data (collapsible feel) */}
                                {step.data && !step.data.reason && !step.data.decision && (
                                  <pre className="mt-2.5 overflow-hidden text-[10px] leading-5 text-muted-foreground whitespace-pre-wrap break-words rounded-lg border border-white/[0.06] bg-black/20 p-2.5 max-h-32 overflow-y-auto scrollbar-hide">
                                    {typeof step.data === 'string' ? step.data : JSON.stringify(step.data, null, 2)}
                                  </pre>
                                )}
                              </article>
                            );
                          })}
                        </Stack>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </Stack>
      </div>

      {/* Result Summary Block */}
      {(latency || resultInfo.success !== null || resultInfo.tool) && (
        <div className={cn(
          'glass-card p-4 flex items-center justify-between gap-4 animate-in fade-in duration-500',
          resultInfo.success === false ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5',
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border',
              resultInfo.success === false
                ? 'border-red-500/20 bg-red-500/10 text-red-400'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
            )}>
              {resultInfo.success === false ? <CircleX className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5" />}
            </div>
            <div>
              <Label className={resultInfo.success === false ? 'text-red-400' : 'text-emerald-400'}>
                {resultInfo.success === false ? 'Execution Failed' : 'Execution Complete'}
              </Label>
              <div className="flex items-center gap-3 mt-1">
                {latency && (
                  <Caption className="flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {latency}
                  </Caption>
                )}
                {resultInfo.tool && (
                  <Caption className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> {String(resultInfo.tool)}
                  </Caption>
                )}
              </div>
            </div>
          </div>
          <Badge variant={resultInfo.success === false ? 'error' : 'success'} className="text-[8px]">
            {resultInfo.success === false ? 'Failed' : 'Success'}
          </Badge>
        </div>
      )}
    </Stack>
  );
};
