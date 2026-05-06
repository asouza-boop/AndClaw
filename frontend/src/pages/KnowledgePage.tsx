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
  Box,
  X
} from 'lucide-react';
import { MemoryCard, MemoryItem, CATEGORY_META } from '@/components/memory/MemoryCard';
import { MemoryInspector } from '@/components/memory/MemoryInspector';
import { useDigestEvents } from '@/hooks/useDigestEvents';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';

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
    { label: 'Memórias', value: memories.length, icon: Database, variant: 'primary' as const },
    { label: 'Categorias', value: availableCategories.length, icon: Tag, variant: 'warning' as const },
    { label: 'Vínculos', value: links.length, icon: Network, variant: 'success' as const },
    { label: 'Com fonte', value: memories.filter((item) => item.source_type).length, icon: ExternalLink, variant: 'info' as const },
  ];

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title={
          <div className="flex items-center gap-3">
            <span>Conhecimento</span>
            <div className="w-2 h-2 rounded-full bg-success" title="SSE Connected" />
          </div>
        } 
        subtitle="Repositório cognitivo consolidado"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLinkDialog(true)}>
              <Link2 size={14} className="mr-2" /> Vínculo
            </Button>
            <Button variant="primary" size="sm" onClick={() => setEntryDialog(true)}>
              <Plus size={14} className="mr-2" /> Nova Memória
            </Button>
          </div>
        }
      />

      <div className="mt-8 flex flex-col gap-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card key={stat.label} padding="lg" shadow="sm">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-md bg-${stat.variant}/10 text-${stat.variant}`}>
                  <stat.icon size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{stat.label}</span>
                  <span className="text-2xl font-black font-mono text-text-primary">{stat.value}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters and Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} className="sm:flex-row sm:items-center">
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <Input 
              placeholder="Buscar memórias ou padrões..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              icon={<Search size={16} />}
            />
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginLeft: 'auto' }}>
            {['all', ...availableCategories].map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
                style={{ borderRadius: 0, border: 'none', fontSize: '10px', textTransform: 'uppercase' }}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Knowledge List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {loadingMemories || loadingLinks ? (
            <KnowledgeSkeleton />
          ) : processedMemories.length === 0 ? (
            <EmptyState 
              icon={<Brain size={48} />}
              title={search ? "Nenhuma correlação encontrada" : "Vácuo Cognitivo Detectado"}
              description={search ? "Tente buscar por termos mais amplos." : "Adicione seu primeiro insight à biblioteca neural."}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

        {/* Neural Mapping Deck */}
        <div>
          <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Network size={14} /> Mapeamento Neural
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {links.map((link) => (
              <Card key={link.id} padding="md" border shadow="sm" className="group hover:border-accent/40">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                   <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', margin: 0 }}>{link.label || 'Vínculo Semântico'}</p>
                   <Link2 size={12} className="text-tertiary group-hover:text-accent transition-colors" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                  <Badge variant="ghost">{link.from_type}</Badge>
                  <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--color-border)' }} />
                  <Badge variant="warning">{link.to_type}</Badge>
                </div>
              </Card>
            ))}
            {links.length === 0 && (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-tertiary)', padding: 'var(--space-8)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                Nenhuma conexão neural implementada.
              </p>
            )}
          </div>
        </div>
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

      {/* Entry Dialog */}
      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <Card padding="lg" border={false} shadow="none">
            <DialogHeader style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <DialogTitle style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-black)' }}>Forge Cognitive Record</DialogTitle>
                <Button variant="ghost" size="sm" onClick={() => setEntryDialog(false)}><X size={16} /></Button>
              </div>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input label="Identidade do Registro" placeholder="Título da memória..." value={entryForm.title} onChange={(e) => setEntryForm((prev) => ({ ...prev, title: e.target.value }))} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Conteúdo Semântico</label>
                <textarea
                  placeholder="Flow markdown protocol..."
                  value={entryForm.content}
                  onChange={(e) => setEntryForm((prev) => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', fontSize: '13px', fontFamily: 'var(--font-mono)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Classe Cognitiva</label>
                  <select
                    value={entryForm.type}
                    onChange={(e) => setEntryForm((prev) => ({ ...prev, type: e.target.value }))}
                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', fontSize: 'var(--text-sm)', outline: 'none' }}
                  >
                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <Input label="Fonte do Protocolo" placeholder="manual / external" value={entryForm.source_type} onChange={(e) => setEntryForm((prev) => ({ ...prev, source_type: e.target.value }))} />
              </div>
            </div>
            <DialogFooter style={{ marginTop: 'var(--space-8)' }}>
              <Button variant="primary" onClick={() => saveEntry.mutate()} disabled={saveEntry.isPending} style={{ width: '100%' }}>
                {saveEntry.isPending ? 'Sincronizando...' : 'Commit para Biblioteca Neural'}
              </Button>
            </DialogFooter>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <Card padding="lg" border={false} shadow="none">
            <DialogHeader style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <DialogTitle style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-black)' }}>Establish Neural Link</DialogTitle>
                <Button variant="ghost" size="sm" onClick={() => setLinkDialog(false)}><X size={16} /></Button>
              </div>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="De (Tipo)" value={linkForm.from_type} onChange={(e) => setLinkForm((prev) => ({ ...prev, from_type: e.target.value }))} />
                <Input label="De (ID)" value={linkForm.from_id} onChange={(e) => setLinkForm((prev) => ({ ...prev, from_id: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Para (Tipo)" value={linkForm.to_type} onChange={(e) => setLinkForm((prev) => ({ ...prev, to_type: e.target.value }))} />
                <Input label="Para (ID)" value={linkForm.to_id} onChange={(e) => setLinkForm((prev) => ({ ...prev, to_id: e.target.value }))} />
              </div>
              <Input label="Rótulo Relacional" placeholder="Ex: Referência técnica" value={linkForm.label} onChange={(e) => setLinkForm((prev) => ({ ...prev, label: e.target.value }))} />
            </div>
            <DialogFooter style={{ marginTop: 'var(--space-8)' }}>
              <Button variant="primary" onClick={() => saveLink.mutate()} disabled={saveLink.isPending} style={{ width: '100%' }}>
                {saveLink.isPending ? 'Mapeando...' : 'Confirmar Conexão'}
              </Button>
            </DialogFooter>
          </Card>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

