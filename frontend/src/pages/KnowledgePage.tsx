import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KnowledgeSkeleton } from '@/components/PageSkeletons';
import {
  BookOpen,
  Brain,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Lightbulb,
  Link2,
  Loader2,
  Network,
  Plus,
  Search,
  Tag,
} from 'lucide-react';

interface MemoryItem {
  id: string;
  type: string;
  content: string;
  source_type?: string | null;
  source_id?: string | null;
  created_at?: string;
}

interface PageLink {
  id: string;
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  label?: string | null;
  created_at?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Brain; tone: string }> = {
  decision: { label: 'Decisão', icon: Lightbulb, tone: 'text-warn' },
  insight: { label: 'Insight', icon: Brain, tone: 'text-primary' },
  memory: { label: 'Memória', icon: Database, tone: 'text-accent' },
  note: { label: 'Nota', icon: FileText, tone: 'text-success' },
};

function parseMemory(memory: MemoryItem) {
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
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [entryDialog, setEntryDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const { data: memories = [], isLoading: loadingMemories } = useQuery<MemoryItem[]>({
    queryKey: ['memory'],
    queryFn: () => apiFetch('/api/knowledge').then(ensureArray),
  });

  const { data: links = [], isLoading: loadingLinks } = useQuery<PageLink[]>({
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

  const filteredMemories = useMemo(() => {
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1">Memory Vault</h1>
          <p className="text-sm text-white/40">Repositório de memória consolidada e vínculos neurais.</p>
        </div>
        <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
          <button 
             onClick={() => setLinkDialog(true)}
             className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <Link2 className="h-3.5 w-3.5" />
            Vínculo
          </button>
          <button 
             onClick={() => setEntryDialog(true)}
             className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-lg"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Memória
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-5 group flex flex-col justify-between h-28">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform ${stat.tone.replace('text-', 'bg-').replace('primary', 'primary/10').replace('accent', 'accent/10').replace('success', 'success/10').replace('warn', 'warn/10')}`}>
                <stat.icon className={`h-4 w-4 ${stat.tone}`} />
              </div>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{stat.label}</span>
            </div>
            <p className="text-2xl font-black text-white tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-white/50 transition-colors" />
          <input
            placeholder="Search cognitive records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5 text-sm text-white focus:outline-none focus:border-primary/40 transition-all placeholder:text-white/10"
          />
        </div>
        <div className="flex gap-2">
           {['all', ...availableCategories].map((cat) => (
             <button
               key={cat}
               onClick={() => setCategoryFilter(cat)}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                 categoryFilter === cat 
                   ? 'bg-white text-black border-white shadow-lg' 
                   : 'bg-white/5 text-white/30 border-white/5 hover:text-white hover:bg-white/10'
               }`}
             >
               {cat}
             </button>
           ))}
        </div>
      </div>

      {loadingMemories || loadingLinks ? (
        <KnowledgeSkeleton />
      ) : filteredMemories.length === 0 ? (
        <div className="glass-card py-24 text-center">
            <Brain className="h-12 w-12 mx-auto text-white/5 mb-4" />
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest">
              {search ? 'Sistema não encontrou correlações' : 'Vácuo cognitivo detectado. Inicie a primeira memória.'}
            </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMemories.map((entry) => {
            const meta = CATEGORY_META[entry.type] || CATEGORY_META.memory;
            const Icon = meta.icon;
            const expanded = expandedId === entry.id;

            return (
              <div key={entry.id} className="glass-card overflow-hidden transition-all duration-300">
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
                          onClick={() => setExpandedId(expanded ? null : entry.id)}
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
                          <ReactMarkdown>{entry.body}</ReactMarkdown>
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
                        <button 
                          onClick={() => setExpandedId(expanded ? null : entry.id)}
                          className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors ml-auto"
                        >
                          {expanded ? 'Collapse' : 'Expand'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Network className="h-4 w-4 text-accent" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Neural Connections</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <div
              key={link.id}
              className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                 <p className="text-xs font-black text-white/80 group-hover:text-primary transition-colors">{link.label || 'Vínculo Semântico'}</p>
                 <Link2 className="h-3 w-3 text-white/10" />
              </div>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">
                {link.from_type} → {link.to_type}
              </p>
            </div>
          ))}
          {links.length === 0 && (
            <div className="col-span-full py-8 text-center border border-dashed border-white/5 rounded-2xl">
               <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Nenhuma conexão estabelecida.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent className="max-w-lg glass-panel border-white/10 bg-black/90 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tighter">Forge Cognitive Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              placeholder="Identificação do Registro (Título)"
              value={entryForm.title}
              onChange={(e) => setEntryForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary/40 transition-all"
            />
            <textarea
              placeholder="Conteúdo semântico em markdown..."
              value={entryForm.content}
              onChange={(e) => setEntryForm((prev) => ({ ...prev, content: e.target.value }))}
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono focus:outline-none focus:border-primary/40 transition-all resize-none"
            />
            <div className="grid grid-cols-2 gap-4">
              <select
                value={entryForm.type}
                onChange={(e) => setEntryForm((prev) => ({ ...prev, type: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs uppercase font-bold tracking-widest focus:outline-none"
              >
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key} className="bg-black text-white">
                    {meta.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Fonte (ex: manual)"
                value={entryForm.source_type}
                onChange={(e) => setEntryForm((prev) => ({ ...prev, source_type: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-primary/40 transition-all"
              />
            </div>
          </div>
          <DialogFooter>
            <button 
              onClick={() => saveEntry.mutate()} 
              disabled={saveEntry.isPending}
              className="w-full py-4 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-white/90 disabled:opacity-20 transition-all"
            >
              {saveEntry.isPending ? 'Synchronizing...' : 'Seal to Vault'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="max-w-lg glass-panel border-white/10 bg-black/90 text-white">
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
