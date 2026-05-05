import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KnowledgeSkeleton } from '@/components/PageSkeletons';
import {
  Brain,
  Database,
  ExternalLink,
  Link2,
  Network,
  Plus,
  Search,
  Tag,
} from 'lucide-react';
import { MemoryCard, MemoryItem, CATEGORY_META } from '@/components/memory/MemoryCard';
import { MemoryInspector } from '@/components/memory/MemoryInspector';
import { useDigestEvents } from '@/hooks/useDigestEvents';

function parseMemory(memory: any) {
  const content = memory.content?.trim() || '';
  const lines = content.split('\n').filter(Boolean);
  const firstLine = lines[0] || 'Sem título';
  const title = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : firstLine.slice(0, 80);
  const body = firstLine.startsWith('#') ? lines.slice(1).join('\n').trim() : content;
  const summary = body.replace(/\s+/g, ' ').slice(0, 180);
  return { title, body: body || content, summary };
}

export default function KnowledgePage() {
  const qc = useQueryClient();
  
  useDigestEvents(() => {
    toast('Memória atualizada', 'success');
  });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [entryDialog, setEntryDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inspectedItem, setInspectedItem] = useState<MemoryItem | null>(null);

  const [entryForm, setEntryForm] = useState({
    title: '',
    content: '',
    type: 'insight',
    source_type: 'manual',
    source_id: '',
  });
  const [linkForm, setLinkForm] = useState({
    from_type: 'memory',
    from_id: '',
    to_type: 'project',
    to_id: '',
    label: '',
  });

  const { data: memories = [], isLoading: loadingMemories } = useQuery<any[]>({
    queryKey: ['memory'],
    queryFn: () => apiFetch('/api/knowledge').then(ensureArray),
  });

  const { data: links = [], isLoading: loadingLinks } = useQuery<any[]>({
    queryKey: ['links'],
    queryFn: () => apiFetch('/api/links').then(ensureArray),
  });

  const saveEntry = useMutation({
    mutationFn: async () => {
      const title = entryForm.title.trim();
      const body = entryForm.content.trim();
      if (!title || !body) throw new Error('Título e conteúdo são obrigatórios');
      const markdown = `# ${title}\n\n${body}`;
      return apiFetch('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify({
          type: entryForm.type,
          content: markdown,
          source_type: entryForm.source_type || null,
          source_id: entryForm.source_id || null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory'] });
      toast('Conhecimento salvo na memória', 'success');
      setEntryDialog(false);
      setEntryForm({ title: '', content: '', type: 'insight', source_type: 'manual', source_id: '' });
    },
    onError: (err: any) => toast(err.message || 'Erro ao salvar conhecimento', 'error'),
  });

  const saveLink = useMutation({
    mutationFn: async () => {
      if (!linkForm.from_type || !linkForm.from_id || !linkForm.to_type || !linkForm.to_id) {
        throw new Error('Preencha origem e destino do vínculo');
      }
      return apiFetch('/api/links', {
        method: 'POST',
        body: JSON.stringify(linkForm),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links'] });
      toast('Vínculo salvo', 'success');
      setLinkDialog(false);
      setLinkForm({ from_type: 'memory', from_id: '', to_type: 'project', to_id: '', label: '' });
    },
    onError: (err: any) => toast(err.message || 'Erro ao salvar vínculo', 'error'),
  });

  const processedMemories = useMemo(() => {
    return memories
      .map((item) => ({ ...item, ...parseMemory(item) }))
      .filter((item) => {
        const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
        const haystack = `${item.title} ${item.body} ${item.type} ${item.source_type || ''}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
      });
  }, [memories, search, categoryFilter]);

  const availableCategories = Array.from(new Set(memories.map((item) => item.type).filter(Boolean)));

  const stats = [
    { label: 'Memórias', value: memories.length, icon: Database, tone: 'text-primary' },
    { label: 'Categorias', value: availableCategories.length, icon: Tag, tone: 'text-accent' },
    { label: 'Vínculos', value: links.length, icon: Network, tone: 'text-success' },
    {
      label: 'Com fonte',
      value: memories.filter((item) => item.source_type).length,
      icon: ExternalLink,
      tone: 'text-warn',
    },
  ];

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-700 relative max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 px-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Memory Vault</h1>
          <p className="text-white/30 text-[13px] font-medium tracking-wide uppercase">Consolidated Cognitive Repository & Neural Mapping</p>
        </div>
        <div className="flex gap-2 p-2 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-md">
          <button 
             onClick={() => setLinkDialog(true)}
             className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-premium"
          >
            <Link2 className="h-3.5 w-3.5" />
            Vínculo
          </button>
          <button 
             onClick={() => setEntryDialog(true)}
             className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-premium shadow-xl shadow-white/5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Memória
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-6 group flex flex-col justify-between h-32 interactive-scale">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-premium ${stat.tone.replace('text-', 'bg-').replace('primary', 'primary/10').replace('accent', 'accent/10').replace('success', 'success/10').replace('warn', 'warn/10')}`}>
                <stat.icon className={`h-4 w-4 ${stat.tone}`} />
              </div>
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] font-mono">{stat.label}</span>
            </div>
            <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-6 px-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-primary transition-colors" />
          <input
            placeholder="Search cognitive records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white/[0.03] border border-white/5 text-[15px] font-medium text-white focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-premium placeholder:text-white/10"
          />
        </div>
        <div className="flex gap-2 p-2 bg-black/20 rounded-2xl border border-white/5">
           {['all', ...availableCategories].map((cat) => (
             <button
               key={cat}
               onClick={() => setCategoryFilter(cat)}
               className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-premium ${
                 categoryFilter === cat 
                   ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                   : 'text-white/30 border-transparent hover:text-white hover:bg-white/5'
               }`}
             >
               {cat}
             </button>
           ))}
        </div>
      </div>

      <div className="px-4">
        {loadingMemories || loadingLinks ? (
          <KnowledgeSkeleton />
        ) : processedMemories.length === 0 ? (
          <div className="glass-card py-32 text-center border-dashed">
              <Brain className="h-16 w-16 mx-auto text-white/5 mb-6" />
              <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">
                {search ? 'No Correlations Identified' : 'Cognitive Vacuum Detected'}
              </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {processedMemories.map((entry) => (
              <MemoryCard 
                key={entry.id} 
                entry={entry} 
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onInspect={(item) => setInspectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slide-over Inspector */}
      <MemoryInspector 
        item={inspectedItem} 
        onClose={() => setInspectedItem(null)} 
        onEstablishLink={() => {
          if (inspectedItem) {
            setLinkForm(prev => ({ ...prev, from_id: inspectedItem.id }));
            setLinkDialog(true);
          }
        }}
      />

      <div className="px-4">
        <div className="glass-card p-10 bg-gradient-to-br from-accent/5 to-transparent">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Network className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 font-mono">Neural Mapping Deck</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {links.map((link) => (
              <div
                key={link.id}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 hover:border-accent/40 transition-premium group interactive-scale"
              >
                <div className="flex items-center justify-between mb-4">
                   <p className="text-[14px] font-bold text-white/80 group-hover:text-accent transition-colors">{link.label || 'Semantic Link'}</p>
                   <Link2 className="h-4 w-4 text-white/10 group-hover:text-accent group-hover:rotate-45 transition-premium" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[9px] font-black text-white/20 uppercase tracking-tighter">
                    {link.from_type}
                  </span>
                  <div className="h-[1px] flex-1 bg-white/5" />
                  <span className="px-2 py-0.5 rounded-lg bg-accent/10 text-[9px] font-black text-accent uppercase tracking-tighter">
                    {link.to_type}
                  </span>
                </div>
              </div>
            ))}
            {links.length === 0 && (
              <div className="col-span-full py-12 text-center border border-dashed border-white/5 rounded-3xl">
                 <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.3em]">No Neural Connections Implemented</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none bg-transparent shadow-none">
          <div className="glass-panel-v2 p-10 space-y-8 animate-in zoom-in-95 duration-300">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter text-white">Forge Cognitive Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Record Identity</p>
                <input
                  placeholder="Identification Header"
                  value={entryForm.title}
                  onChange={(e) => setEntryForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary/40 transition-premium font-outfit"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Semantic Content</p>
                <textarea
                  placeholder="Markdown flow protocol..."
                  value={entryForm.content}
                  onChange={(e) => setEntryForm((prev) => ({ ...prev, content: e.target.value }))}
                  rows={8}
                  className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[13px] font-mono text-white/80 focus:outline-none focus:border-primary/40 transition-premium resize-none scrollbar-hide"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Cognitive Class</p>
                  <select
                    value={entryForm.type}
                    onChange={(e) => setEntryForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/60 focus:outline-none"
                  >
                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                      <option key={key} value={key} className="bg-[#0a0a0c] text-white">
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Protocol Source</p>
                  <input
                    placeholder="manual / external"
                    value={entryForm.source_type}
                    onChange={(e) => setEntryForm((prev) => ({ ...prev, source_type: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/60 focus:outline-none focus:border-primary/40 transition-premium"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <button 
                onClick={() => saveEntry.mutate()} 
                disabled={saveEntry.isPending}
                className="w-full py-5 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white disabled:opacity-20 transition-premium shadow-2xl"
              >
                {saveEntry.isPending ? 'Synchronizing Pipeline...' : 'Commit to Neural Library'}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="max-w-lg glass-panel border-white/10 bg-black/90 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tighter">Establish Neural Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                placeholder="From Type"
                value={linkForm.from_type}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, from_type: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-primary/40"
              />
              <input
                placeholder="From ID"
                value={linkForm.from_id}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, from_id: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                placeholder="To Type"
                value={linkForm.to_type}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, to_type: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-primary/40"
              />
              <input
                placeholder="To ID"
                value={linkForm.to_id}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, to_id: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-primary/40"
              />
            </div>
            <input
              placeholder="Relational Label"
              value={linkForm.label}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, label: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-primary/40"
            />
          </div>
          <DialogFooter>
            <button 
              onClick={() => saveLink.mutate()} 
              disabled={saveLink.isPending}
              className="w-full py-4 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-white/90 disabled:opacity-20 transition-all font-black"
            >
              {saveLink.isPending ? 'Mapping...' : 'Confirm Connection'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
