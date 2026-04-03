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
    queryFn: () => apiFetch('/api/memory').then(ensureArray),
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
      return apiFetch('/api/memory', {
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
    <div className="space-y-4 pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[Outfit] flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Conhecimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Memória consolidada, anotações estruturadas e vínculos entre páginas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLinkDialog(true)}>
            <Link2 className="h-4 w-4 mr-1" />
            Novo vínculo
          </Button>
          <Button size="sm" onClick={() => setEntryDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova memória
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-secondary/50 ${stat.tone}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold font-[Outfit]">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar memória..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {availableCategories.map((category) => {
              const meta = CATEGORY_META[category];
              const Icon = meta?.icon || Database;
              return (
                <SelectItem key={category} value={category}>
                  <span className="flex items-center gap-2">
                    <Icon className={`h-3 w-3 ${meta?.tone || 'text-muted-foreground'}`} />
                    {meta?.label || category}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {loadingMemories || loadingLinks ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredMemories.length === 0 ? (
        <Card className="bg-card border-border/50">
          <CardContent className="p-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {search ? 'Nenhum resultado para esta busca.' : 'Nenhuma memória registrada ainda.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredMemories.map((entry) => {
            const meta = CATEGORY_META[entry.type] || CATEGORY_META.memory;
            const Icon = meta.icon;
            const expanded = expandedId === entry.id;

            return (
              <Card key={entry.id} className="bg-card border-border/50 hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-secondary/50 mt-0.5 ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        className="text-left w-full"
                        onClick={() => setExpandedId(expanded ? null : entry.id)}
                      >
                        <h3 className="text-sm font-semibold leading-tight">{entry.title}</h3>
                        {!expanded && entry.summary ? (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.summary}</p>
                        ) : null}
                      </button>

                      {expanded ? (
                        <div className="mt-3 text-sm text-foreground/80 prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{entry.body}</ReactMarkdown>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className={`text-[10px] ${meta.tone}`}>
                          {meta.label}
                        </Badge>
                        {entry.source_type ? (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.source_type}
                          </Badge>
                        ) : null}
                        {entry.created_at ? (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-card border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">Vínculos entre páginas</h2>
          </div>
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="rounded-lg bg-surface-2 border border-border p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium">{link.label || 'Ligação sem rótulo'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {link.from_type}:{link.from_id} → {link.to_type}:{link.to_id}
                  </p>
                </div>
              </div>
            ))}
            {links.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum vínculo cadastrado.</p> : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova memória</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Título"
              value={entryForm.title}
              onChange={(e) => setEntryForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Textarea
              placeholder="Conteúdo em markdown"
              value={entryForm.content}
              onChange={(e) => setEntryForm((prev) => ({ ...prev, content: e.target.value }))}
              rows={8}
              className="font-mono text-xs"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                value={entryForm.type}
                onValueChange={(value) => setEntryForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Fonte ex.: manual"
                value={entryForm.source_type}
                onChange={(e) => setEntryForm((prev) => ({ ...prev, source_type: e.target.value }))}
              />
            </div>
            <Input
              placeholder="ID da origem (opcional)"
              value={entryForm.source_id}
              onChange={(e) => setEntryForm((prev) => ({ ...prev, source_id: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => saveEntry.mutate()} disabled={saveEntry.isPending}>
              {saveEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo vínculo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Origem tipo"
                value={linkForm.from_type}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, from_type: e.target.value }))}
              />
              <Input
                placeholder="Origem ID"
                value={linkForm.from_id}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, from_id: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Destino tipo"
                value={linkForm.to_type}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, to_type: e.target.value }))}
              />
              <Input
                placeholder="Destino ID"
                value={linkForm.to_id}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, to_id: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Rótulo do vínculo"
              value={linkForm.label}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, label: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => saveLink.mutate()} disabled={saveLink.isPending}>
              {saveLink.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
