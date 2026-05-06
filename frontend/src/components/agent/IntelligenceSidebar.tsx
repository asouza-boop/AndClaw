import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Brain, Database, Shield, Activity, Zap, Workflow, ShieldCheck } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { ExecutionTimeline, TraceStep } from './ExecutionTimeline';
import { MemoryInspector } from './MemoryInspector';
import { apiFetch, ensureArray } from '@/lib/api';
import type { MemoryItem } from '../memory/MemoryCard';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/badge';
import { Stack } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Label, Caption } from '@/components/ui/Typography';

type KnowledgeRow = MemoryItem & {
  _id?: string;
  category?: string;
  summary?: string;
};

const memoryIdKeys = new Set([
  'memoryId',
  'memory_id',
  'memoryIDs',
  'memory_ids',
  'knowledgeId',
  'knowledge_id',
  'knowledgeIDs',
  'knowledge_ids',
  'sourceId',
  'source_id',
]);

function collectTraceMemoryIds(value: unknown, ids = new Set<string>()) {
  if (!value) return ids;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTraceMemoryIds(entry, ids));
    return ids;
  }
  if (typeof value !== 'object') return ids;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (memoryIdKeys.has(key)) {
      if (Array.isArray(entry)) {
        entry.forEach((item) => {
          if (typeof item === 'string' || typeof item === 'number') ids.add(String(item));
        });
      } else if (typeof entry === 'string' || typeof entry === 'number') {
        ids.add(String(entry));
      }
    }
    collectTraceMemoryIds(entry, ids);
  }
  return ids;
}

function parseKnowledgeRow(row: KnowledgeRow): MemoryItem {
  const content = row.content || row.body || row.summary || '';
  const title = row.title || content.split('\n').find(Boolean)?.replace(/^#+\s*/, '').slice(0, 90) || 'Untitled memory';
  const body = row.body || content;
  const summary = row.summary || body.replace(/\s+/g, ' ').trim().slice(0, 220) || 'No summary available.';

  return {
    ...row,
    id: String(row.id ?? row._id ?? title),
    type: row.type || row.category || 'memory',
    content,
    title,
    body,
    summary,
  };
}

function buildMemoryContext(
  pathname: string,
  title: string | undefined,
  traceSteps: Array<{ type?: string; status?: string; data?: Record<string, unknown>; timestamp?: string }>,
  requestId: string | null,
) {
  const traceText = (traceSteps || [])
    .map((step) => {
      const stepData = step.data ? JSON.stringify(step.data) : '';
      return [step.type, step.status, stepData].filter(Boolean).join(' ');
    })
    .join(' ');

  return [pathname, title || '', requestId || '', traceText].filter(Boolean).join('\n');
}

type TabId = 'why' | 'memory' | 'trace' | 'security';

interface IntelligenceSidebarProps {
  title?: string;
}

export function IntelligenceSidebar({ title }: IntelligenceSidebarProps = {}) {
  const [activeTab, setActiveTab] = useState<TabId>('why');
  const location = useLocation();
  const queryClient = useQueryClient();
  const { currentTrace, currentRequestId } = useAgentStore();

  const traceSteps = Array.isArray(currentTrace?.steps) ? currentTrace.steps : [];
  
  const reasoningSteps = traceSteps.filter(s => s && ['agent.intent.detected', 'agent.plan.created', 'agent.control.paused', 'agent.skill.selected'].includes(s.type || ''));
  const memorySteps = useMemo(
    () => traceSteps.filter((step) => step?.type?.includes('memory') || step?.type?.includes('cache')),
    [traceSteps],
  );
  const securitySteps = traceSteps.filter(s => s && ['agent.security.blocked', 'agent.spec.violation'].includes(s.type || ''));

  const usedMemoryIds = useMemo(() => {
    const ids = new Set<string>();
    traceSteps.forEach((step) => collectTraceMemoryIds(step?.data, ids));
    return ids;
  }, [traceSteps]);

  const { data: knowledgeRows = [], isLoading: knowledgeLoading } = useQuery({
    queryKey: ['intelligence-sidebar', 'knowledge'],
    queryFn: () => apiFetch('/api/knowledge').catch(() => []).then(ensureArray),
    staleTime: 30_000,
  });

  const knowledgeMemories = useMemo<MemoryItem[]>(
    () => (Array.isArray(knowledgeRows) ? knowledgeRows : []).map((row: KnowledgeRow) => parseKnowledgeRow(row)),
    [knowledgeRows],
  );

  const memoryContextText = useMemo(
    () => buildMemoryContext(location.pathname, title, traceSteps, currentRequestId),
    [currentRequestId, location.pathname, title, traceSteps],
  );

  const deleteMemory = useMutation({
    mutationFn: (item: MemoryItem) => apiFetch(`/api/knowledge/${item.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-sidebar', 'knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
    onError: (error: unknown) => {
      console.error(error);
    },
  });

  const tabs: { id: TabId; icon: any; label: string }[] = [
    { id: 'why', icon: Brain, label: 'WHY' },
    { id: 'memory', icon: Database, label: 'MEMORY' },
    { id: 'trace', icon: Workflow, label: 'TRACE' },
    { id: 'security', icon: Shield, label: 'SECURITY' },
  ];

  return (
    <Panel variant="sidebar" className="w-full flex flex-col animate-in fade-in duration-700 font-outfit rounded-none">
      {/* Tab Bar */}
      <div className="flex bg-black/40 border-b border-white/5">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-2 py-4 transition-all duration-300 relative ${
              activeTab === id 
                ? 'text-primary' 
                : 'text-white/30 hover:text-white/70'
            }`}
          >
            <Icon className="w-4 h-4" />
            <Label className={`text-[9px] ${activeTab === id ? 'text-primary' : 'text-inherit'}`}>
              {label}
            </Label>
            {activeTab === id && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary shadow-[0_0_10px_rgba(168,85,247,0.5)] rounded-full animate-in fade-in duration-300" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {/* WHY Tab */}
        {activeTab === 'why' && (
          <Stack className="gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <Label className="text-white/40 flex items-center gap-2">
                <Brain className="w-3 h-3 text-primary" />
                Decision Reasoning
              </Label>
              {reasoningSteps.length > 0 && (
                <Badge variant="optimizing" className="text-[8px]">
                  {reasoningSteps.length} decision{reasoningSteps.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {reasoningSteps.length > 0 ? (
              <Stack className="gap-4">
                {reasoningSteps.map((step, i) => {
                  const isFallback = (step.type || '').includes('fallback');
                  const isPlan = (step.type || '').includes('plan');
                  const isSkill = (step.type || '').includes('skill');

                  return (
                    <div key={i} className="glass-card p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-foreground/90">
                          {(step.type || '').split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Step'}
                        </Label>
                        {isFallback && <Badge variant="fallback" className="text-[8px]">Fallback</Badge>}
                        {isPlan && <Badge variant="optimizing" className="text-[8px]">Primary Path</Badge>}
                        {isSkill && <Badge variant="success" className="text-[8px]">Optimized</Badge>}
                      </div>

                      {step.data?.reason && (
                        <div className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                          <Caption className="text-primary/70 mb-1">Reasoning</Caption>
                          <p className="text-xs text-white/80 leading-relaxed">{String(step.data.reason)}</p>
                        </div>
                      )}

                      {step.data?.decision && (
                        <div className="px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
                          <Caption className="text-accent/70 mb-1">Decision</Caption>
                          <p className="text-xs text-white/80 leading-relaxed">{String(step.data.decision)}</p>
                        </div>
                      )}

                      {step.data && !step.data.reason && !step.data.decision && (
                        <Caption as="p" className="text-white/50 italic leading-relaxed">
                          {typeof step.data === 'string' ? step.data : JSON.stringify(step.data, null, 2).slice(0, 200)}
                        </Caption>
                      )}

                      <Caption className="text-white/20">
                        {step.status || 'processed'}
                      </Caption>
                    </div>
                  );
                })}
              </Stack>
            ) : (
              <EmptyState
                icon={<Brain size={48} />}
                title="Waiting for reasoning"
                description="Agent decision steps will appear here as the engine processes your request."
                className="py-12"
              />
            )}
          </Stack>
        )}

        {/* MEMORY Tab */}
        {activeTab === 'memory' && (
          <Stack className="gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <Label className="text-white/40 flex items-center gap-2">
                <Database className="w-3 h-3 text-accent" />
                Memory Events
              </Label>
              {memorySteps.length > 0 && (
                <Badge variant="cached" className="text-[8px]">
                  {memorySteps.length} event{memorySteps.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <Stack className="gap-3">
              {(memorySteps || []).map((step, i) => {
                const isHit = step.status === 'hit';
                return (
                  <div
                    key={i}
                    className={`glass-card p-4 transition-all duration-300 animate-in slide-in-from-bottom-1 ${
                      isHit ? 'border-accent/30 hover:border-accent/50' : 'hover:border-white/15'
                    }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant={isHit ? 'cached' : 'glass'} className="text-[8px]">
                        {isHit ? 'Cache Match' : 'Cold Fetch'}
                      </Badge>
                      {step.data?.similarity && (
                        <Caption className="font-mono text-white/40">
                          SIM: {(Number(step.data.similarity) * 100).toFixed(0)}%
                        </Caption>
                      )}
                    </div>
                    <Caption as="p" className="text-white/60 italic leading-relaxed">
                      Vector analysis identified relevant context for user directive.
                    </Caption>
                  </div>
                );
              })}
            </Stack>

            {(!memorySteps || memorySteps.length === 0) && (
              <EmptyState
                icon={<Database size={48} />}
                title="No memory events"
                description="Semantic context lookups will appear here during agent processing."
                className="py-10"
              />
            )}

            <div className="mt-4 pt-4 border-t border-white/5">
              <Label className="text-white/40 flex items-center gap-2 mb-4">
                <Database className="w-3 h-3 text-primary" />
                Knowledge Base
              </Label>
              <MemoryInspector
                memories={knowledgeMemories || []}
                contextText={memoryContextText}
                usedMemoryIds={usedMemoryIds}
                emptyMessage={knowledgeLoading ? 'Loading semantic memories...' : 'No semantic memory available yet.'}
                onDelete={(item) => deleteMemory.mutate(item)}
              />
            </div>
          </Stack>
        )}

        {/* TRACE Tab */}
        {activeTab === 'trace' && (
          <Stack className="gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <Label className="text-white/40 flex items-center gap-2">
                <Workflow className="w-3 h-3 text-primary" />
                Execution Trace
              </Label>
              {traceSteps.length > 0 && (
                <Badge variant="glass" className="text-[8px]">
                  {traceSteps.length} step{traceSteps.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <ExecutionTimeline
              steps={(traceSteps || []) as TraceStep[]}
              title="Full Execution Pipeline"
              emptyMessage="Waiting for cognitive trace..."
            />
          </Stack>
        )}

        {/* SECURITY Tab */}
        {activeTab === 'security' && (
          <Stack className="gap-6 animate-in fade-in duration-500">
            <Label className="text-white/40 flex items-center gap-2">
              <Shield className="w-3 h-3 text-rose-500" />
              Governance Deck
            </Label>

            <div className="glass-card p-4 border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <Label className="text-emerald-400">Active Constitution</Label>
              </div>
              <Caption as="p" className="text-white/40 leading-relaxed">
                Prompt injection monitoring and recursive policy enforcement initialized.
              </Caption>
            </div>

            {(!securitySteps || securitySteps.length === 0) ? (
              <EmptyState
                icon={<ShieldCheck size={48} />}
                title="No violations detected"
                description="The governance engine is actively monitoring. All operations are within policy bounds."
                className="py-10 border-emerald-500/10"
              />
            ) : (
              <Stack className="gap-3">
                {(securitySteps || []).map((step, i) => {
                  const isBlock = (step.type || '').includes('blocked');
                  return (
                    <div
                      key={i}
                      className={`glass-card p-4 animate-in slide-in-from-bottom-1 duration-300 ${
                        isBlock
                          ? 'border-red-500/20 bg-red-500/5 hover:border-red-500/30'
                          : 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30'
                      }`}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={isBlock ? 'error' : 'fallback'} className="text-[8px]">
                          {isBlock ? 'Blocked' : 'Warning'}
                        </Badge>
                      </div>
                      <Caption as="p" className="text-white/80 leading-relaxed">
                        {step.data?.reason || 'Access denied by governance policy.'}
                      </Caption>
                    </div>
                  );
                })}
              </Stack>
            )}
          </Stack>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-6 border-t border-white/5 bg-black/60 space-y-4">
        <a 
          href="/evolucao"
          className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all duration-300 group"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <Label className="text-primary">Engine Metrics</Label>
          </div>
          <Zap className="w-4 h-4 text-primary group-hover:translate-x-1 transition-all duration-300" />
        </a>
        <div className="flex items-center justify-center py-2">
          <Caption className="text-white/10 tracking-[0.3em]">Explainability Mode v2.0</Caption>
        </div>
      </div>
    </Panel>
  );
}


