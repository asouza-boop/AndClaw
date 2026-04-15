import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Clock3, Eye, Pin, PinOff, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MemoryItem } from '@/components/memory/MemoryCard';
import { useAgentStore } from '@/stores/agentStore';

export interface InspectorMemoryItem extends MemoryItem {
  title: string;
  body: string;
  summary: string;
  similarity: number;
  recency: number;
  score: number;
  pinned: boolean;
  used: boolean;
}

interface MemoryInspectorProps {
  memories: MemoryItem[];
  contextText: string;
  usedMemoryIds?: Set<string>;
  emptyMessage?: string;
  onDelete: (item: MemoryItem) => void;
}

const PIN_STORAGE_KEY = 'andclaw.sidebar.pinned-memories.v1';

function parseMemory(memory: MemoryItem) {
  const content = memory.content?.trim() || '';
  const lines = content.split('\n').filter(Boolean);
  const firstLine = lines[0] || 'Untitled memory';
  const title = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : firstLine.slice(0, 90);
  const body = firstLine.startsWith('#') ? lines.slice(1).join('\n').trim() : content;
  const summary = (memory.summary || body || content).replace(/\s+/g, ' ').trim().slice(0, 220);
  
  return {
    ...memory,
    title,
    body: body || content,
    summary: summary || 'No summary available.',
  };
}

function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2),
  );
}

function similarityScore(source: string, context: string) {
  const sourceTokens = tokenize(source);
  const contextTokens = tokenize(context);
  if (sourceTokens.size === 0 || contextTokens.size === 0) return 0;
  
  let matches = 0;
  sourceTokens.forEach((token) => {
    if (contextTokens.has(token)) matches += 1;
  });
  
  return matches / Math.max(sourceTokens.size, contextTokens.size);
}

function recencyScore(createdAt?: string) {
  if (!createdAt) return 0;
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return 0;
  
  const ageHours = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
  return 1 / (1 + ageHours / 24);
}

function formatRecency(createdAt?: string) {
  if (!createdAt) return 'Unknown';
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return 'Unknown';
  
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  
  return `${days}d ago`;
}

function loadPinnedIds() {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [] as string[];
  }
}

function savePinnedIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(ids));
}

export function MemoryInspector({
  memories,
  contextText,
  usedMemoryIds = new Set(),
  emptyMessage = 'No semantic memory available yet.',
  onDelete,
}: MemoryInspectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => loadPinnedIds());
  const { featureFlags } = useAgentStore();

  useEffect(() => {
    setPinnedIds(loadPinnedIds());
  }, []);

  const enrichedMemories = useMemo<InspectorMemoryItem[]>(() => {
    const safeMemories = Array.isArray(memories) ? memories : [];
    return safeMemories
      .map(parseMemory)
      .map((item) => {
        const source = `${item.title} ${item.body} ${item.summary} ${item.type} ${item.source_type || ''}`;
        const similarity = similarityScore(source, contextText);
        const recency = recencyScore(item.created_at);
        const pinned = pinnedIds.includes(String(item.id));
        const used = usedMemoryIds.has(String(item.id)) || (usedMemoryIds.size === 0 && similarity >= 0.4);
        const score = (similarity * 0.72) + (recency * 0.28);
        return { ...item, similarity, recency, pinned, used, score };
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.used !== b.used) return a.used ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        return bTime - aTime;
      });
  }, [contextText, memories, pinnedIds, usedMemoryIds]);

  const activeItem = enrichedMemories.find((item) => item.id && String(item.id) === hoveredId) || enrichedMemories[0] || null;

  const togglePin = (id?: string | number | null) => {
    if (id === undefined || id === null) return;
    const key = String(id);
    setPinnedIds((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [key, ...current];
      savePinnedIds(next);
      return next;
    });
  };

  const detailScore = activeItem ? Math.round(activeItem.similarity * 100) : 0;
  const detailRecency = activeItem ? formatRecency(activeItem.created_at) : 'Unknown';

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Semantic memory</p>
            <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Top memories</h3>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/10 px-3 py-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {enrichedMemories.slice(0, 5).map((item) => {
            const id = String(item.id ?? item.content.slice(0, 24));
            const isActive = activeItem && String(activeItem.id ?? activeItem.content.slice(0, 24)) === id;
            return (
              <button
                key={id}
                type="button"
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(id)}
                onClick={() => setHoveredId(id)}
                className={cn(
                  'group w-full rounded-2xl border px-3 py-3 text-left transition-all',
                  featureFlags.UI_MEMORY_INSPECTOR_V2 ? 'duration-500' : 'duration-200',
                  item.used
                    ? 'border-primary/20 bg-primary/[0.08] shadow-[0_18px_45px_-30px_rgba(168,85,247,0.45)]'
                    : 'border-white/[0.06] bg-surface/45 hover:border-white/[0.1] hover:bg-white/[0.05]',
                  isActive && 'ring-1 ring-primary/20',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors',
                      item.used
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground',
                    )}
                  >
                    <Eye className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <div className="flex items-center gap-2">
                        {item.used ? (
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                            Used
                          </span>
                        ) : null}
                        {item.pinned ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                            Pinned
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</p>
                    <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <span>{formatRecency(item.created_at)}</span>
                      <span>{Math.round(item.similarity * 100)}% similarity</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {enrichedMemories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
        {activeItem ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Inspector</p>
                <h3 className="mt-2 truncate text-base font-semibold tracking-tight text-foreground">{activeItem.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => togglePin(activeItem.id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/10 hover:text-primary"
                  aria-label={activeItem.pinned ? 'Unpin memory' : 'Pin memory'}
                >
                  {activeItem.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(activeItem)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete memory"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <div className="rounded-xl border border-white/[0.06] bg-surface/45 px-3 py-3">
                <p className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Similarity
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{detailScore}%</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-surface/45 px-3 py-3">
                <p className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  Recency
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{detailRecency}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-surface/45 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Content</p>
              <div className="prose prose-sm prose-invert mt-3 max-w-none text-sm leading-6 text-foreground/85">
                <ReactMarkdown>{activeItem.body || activeItem.summary}</ReactMarkdown>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">{activeItem.type}</span>
              {activeItem.source_type ? (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">{activeItem.source_type}</span>
              ) : null}
              {activeItem.pinned ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-300">Pinned</span>
              ) : null}
              {activeItem.used ? (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">Used in trace</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </section>
    </div>
  );
}
