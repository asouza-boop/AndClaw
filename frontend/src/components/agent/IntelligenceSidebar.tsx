import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Brain, Database, Shield, Activity, Zap } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { ExecutionTimeline, TraceStep } from './ExecutionTimeline';
import { MemoryInspector } from './MemoryInspector';
import { apiFetch, ensureArray } from '@/lib/api';
import type { MemoryItem } from '../memory/MemoryCard';

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
  const traceText = traceSteps
    .map((step) => {
      const stepData = step.data ? JSON.stringify(step.data) : '';
      return [step.type, step.status, stepData].filter(Boolean).join(' ');
    })
    .join(' ');

  return [pathname, title || '', requestId || '', traceText].filter(Boolean).join('\n');
}

interface IntelligenceSidebarProps {
  title?: string;
}

export function IntelligenceSidebar({ title }: IntelligenceSidebarProps = {}) {
  const [activeTab, setActiveTab] = useState<'why' | 'memory' | 'security'>('why');
  const location = useLocation();
  const queryClient = useQueryClient();
  const { currentTrace, currentRequestId } = useAgentStore();

  const traceSteps = currentTrace?.steps || [];
  
  const reasoningSteps = traceSteps.filter(s => ['agent.intent.detected', 'agent.plan.created', 'agent.control.paused'].includes(s.type));
  const memorySteps = useMemo(
    () => traceSteps.filter((step) => step.type.includes('memory') || step.type.includes('cache')),
    [traceSteps],
  );
  const securitySteps = traceSteps.filter(s => ['agent.security.blocked', 'agent.spec.violation'].includes(s.type));

  const usedMemoryIds = useMemo(() => {
    const ids = new Set<string>();
    traceSteps.forEach((step) => collectTraceMemoryIds(step.data, ids));
    return ids;
  }, [traceSteps]);

  const { data: knowledgeRows = [], isLoading: knowledgeLoading } = useQuery({
    queryKey: ['intelligence-sidebar', 'knowledge'],
    queryFn: () => apiFetch('/api/knowledge').catch(() => []).then(ensureArray),
    staleTime: 30_000,
  });

  const knowledgeMemories = useMemo<MemoryItem[]>(
    () => knowledgeRows.map((row: KnowledgeRow) => parseKnowledgeRow(row)),
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
              Recent Memory Events
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

            <div className="mt-8">
              <MemoryInspector
                memories={knowledgeMemories}
                contextText={memoryContextText}
                usedMemoryIds={usedMemoryIds}
                emptyMessage={knowledgeLoading ? 'Loading semantic memories...' : 'No semantic memory available yet.'}
                onDelete={(item) => deleteMemory.mutate(item)}
              />
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
