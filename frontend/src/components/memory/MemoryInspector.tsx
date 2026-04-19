import React from 'react';
import { X, Network, Link2, ExternalLink, Calendar, Database, Target, TrendingUp, Zap, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import * as Typography from "@/components/ui/Typography";
import { MemoryItem, CATEGORY_META } from './MemoryCard';

interface MemoryInspectorProps {
  item: MemoryItem | null;
  onClose: () => void;
  onEstablishLink?: () => void;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({ item, onClose, onEstablishLink }) => {
  if (!item) return null;

  const meta = CATEGORY_META[item.type] || CATEGORY_META.memory;
  const Icon = meta.icon;

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] glass-sidebar z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${meta.tone.replace('text-', 'bg-').replace('primary', 'primary/10')}`}>
            <Icon className={`h-4 w-4 ${meta.tone}`} />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Semantic Inspection</h2>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{item.type} Record</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all outline-none"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
        <section>
          <h1 className="text-2xl font-black text-white tracking-tighter leading-tight">{item.title}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-white/30 tracking-widest bg-white/5 px-2 py-1 rounded-lg border border-white/5">
              <Calendar className="w-3 h-3" />
              <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</span>
            </div>
            {item.source_type && (
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary tracking-widest bg-primary/5 px-2 py-1 rounded-lg border border-primary/20">
                <ExternalLink className="w-3 h-3" />
                <span>Source: {item.source_type}</span>
              </div>
            )}
            {item.memory_type && (
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-accent tracking-widest bg-accent/5 px-2 py-1 rounded-lg border border-accent/20">
                <Zap className="w-3 h-3" />
                <span>{item.memory_type}</span>
              </div>
            )}
          </div>
        </section>

        {/* Semantic Telemetry */}
        <section className="grid grid-cols-2 gap-4">
           <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
             <div className="flex items-center justify-between">
                <Typography.Label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Neural Confidence</Typography.Label>
                <Target className="w-3 h-3 text-white/20" />
             </div>
             <div className="space-y-1">
                <Typography.Title className="text-lg font-black text-white">
                    {item.similarityScore ? `${(Math.max(0, (1 - item.similarityScore)) * 100).toFixed(1)}%` : 'N/A'}
                </Typography.Title>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${item.similarityScore ? Math.max(0, (1 - item.similarityScore)) * 100 : 0}%` }} />
                </div>
             </div>
           </div>

           <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
             <div className="flex items-center justify-between">
                <Typography.Label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Engagement</Typography.Label>
                <TrendingUp className="w-3 h-3 text-white/20" />
             </div>
             <div className="space-y-1">
                <Typography.Title className="text-lg font-black text-white">
                    {item.usage_count || 0} Uses
                </Typography.Title>
                <Typography.Caption className="text-[8px] text-white/20 uppercase font-bold tracking-tighter">Usage weight applied to Ranking</Typography.Caption>
             </div>
           </div>
        </section>

        <section className="prose prose-sm prose-invert max-w-none">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-white/80 leading-relaxed font-outfit text-sm italic">
            <ReactMarkdown>{item.body || ''}</ReactMarkdown>
          </div>
        </section>

        <section className="space-y-4">
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
             <Network className="w-3 h-3" />
             Neural Connections
           </h3>
           <div className="p-4 rounded-2xl bg-black/40 border border-dashed border-white/10 flex flex-col items-center justify-center text-center py-12">
              <Link2 className="w-8 h-8 text-white/5 mb-3" />
              <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Vínculos diretos serão mapeados aqui</p>
           </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-white/5 bg-black/40 space-y-4">
         <button 
           onClick={onEstablishLink}
           className="w-full py-4 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-lg flex items-center justify-center gap-2"
         >
           <Network className="w-4 h-4" />
           Establish Connection
         </button>
         <button 
           onClick={onClose}
           className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
         >
           Close Inspection
         </button>
      </div>
    </div>
  );
};
