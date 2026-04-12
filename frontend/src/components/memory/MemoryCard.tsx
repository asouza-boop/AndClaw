import React from 'react';
import { Brain, Database, FileText, Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface MemoryItem {
  id: string;
  type: string;
  content: string;
  source_type?: string | null;
  source_id?: string | null;
  created_at?: string;
  title?: string;
  body?: string;
  summary?: string;
}

export const CATEGORY_META: Record<string, { label: string; icon: any; tone: string }> = {
  decision: { label: 'Decisão', icon: Lightbulb, tone: 'text-warn' },
  insight: { label: 'Insight', icon: Brain, tone: 'text-primary' },
  memory: { label: 'Memória', icon: Database, tone: 'text-accent' },
  note: { label: 'Nota', icon: FileText, tone: 'text-success' },
};

interface MemoryCardProps {
  entry: MemoryItem;
  expanded: boolean;
  onToggle: () => void;
  onInspect: (entry: MemoryItem) => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ entry, expanded, onToggle, onInspect }) => {
  const meta = CATEGORY_META[entry.type] || CATEGORY_META.memory;
  const Icon = meta.icon;

  return (
    <div className="glass-card overflow-hidden transition-all duration-300">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl border border-white/10 ${meta.tone.replace('text-', 'bg-').replace('primary', 'primary/10').replace('accent', 'accent/10').replace('success', 'success/10').replace('warn', 'warn/10')} shadow-sm`}>
            <Icon className={`h-4 w-4 ${meta.tone}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                className="text-left group"
                onClick={onToggle}
              >
                <h3 className="text-md font-black text-white tracking-tight group-hover:text-primary transition-colors">{entry.title}</h3>
              </button>
              <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">
                {entry.created_at ? new Date(entry.created_at).toLocaleDateString('pt-BR') : ''}
              </span>
            </div>
            
            {!expanded && entry.summary ? (
              <p className="text-xs text-white/40 italic line-clamp-2 leading-relaxed">{entry.summary}</p>
            ) : null}

            {expanded ? (
              <div className="mt-4 text-xs text-white/70 leading-relaxed prose prose-sm prose-invert max-w-none animate-in fade-in slide-in-from-top-2">
                <ReactMarkdown>{entry.body || ''}</ReactMarkdown>
              </div>
            ) : null}

            <div className="flex items-center gap-3 mt-4">
              <span className={`text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/5 font-black uppercase tracking-widest ${meta.tone}`}>
                {meta.label}
              </span>
              {entry.source_type && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/5 text-white/30 font-bold uppercase">
                  Source: {entry.source_type}
                </span>
              )}
              <div className="ml-auto flex gap-4">
                <button 
                  onClick={onToggle}
                  className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors"
                >
                  {expanded ? 'Collapse' : 'Expand'}
                </button>
                <button 
                  onClick={() => onInspect(entry)}
                  className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/100 transition-colors"
                >
                  Inspect
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
