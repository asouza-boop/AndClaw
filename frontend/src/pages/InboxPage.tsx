import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useMemo } from 'react';
import { 
  Trash2, CheckSquare, Archive, Loader2, Sparkles, Plus, 
  Calendar, FolderKanban, MessageSquare, Link as LinkIcon,
  Search, Filter, ChevronRight, Clock, Target
} from 'lucide-react';
import { PageContainer, Section, Stack, Grid } from '@/components/ui/Layout';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/badge';
import * as Typography from "@/components/ui/Typography";
import { Button } from '@/components/ui/button';

/* ─── Types ─── */
interface UnifiedItem {
  id: string;
  type: 'task' | 'meeting' | 'project' | 'link' | 'note' | 'idea';
  title: string;
  status: string;
  createdAt: string;
  metadata?: any;
  raw?: any;
}

const typeConfig: Record<string, { label: string; icon: any; variant: any }> = {
  task: { label: 'Tarefa', icon: CheckSquare, variant: 'cached' },
  meeting: { label: 'Reunião', icon: Calendar, variant: 'secondary' },
  project: { label: 'Projeto', icon: FolderKanban, variant: 'optimizing' },
  link: { label: 'Link', icon: LinkIcon, variant: 'glass' },
  note: { label: 'Nota', icon: MessageSquare, variant: 'glass' },
  idea: { label: 'Ideia', icon: Sparkles, variant: 'glass' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function InboxPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [captureText, setCaptureText] = useState('');

  /* Queries */
  const { data: captures = [] } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => apiFetch('/api/tasks').then(ensureArray) });
  const { data: meetings = [] } = useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch('/api/meetings').then(ensureArray) });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => apiFetch('/api/projects').then(ensureArray) });

  /* Aggregation */
  const unifiedItems = useMemo(() => {
    const items: UnifiedItem[] = [];

    // 1. Process Captures (Signals)
    captures.forEach((c: any) => {
      if (c.status === 'processed' && (c.type === 'task' || c.type === 'meeting' || c.type === 'project')) return;
      items.push({
        id: c.id || c._id,
        type: c.type || 'note',
        title: c.content,
        status: c.status,
        createdAt: c.createdAt || c.created_at,
        raw: c
      });
    });

    // 2. Process Tasks
    tasks.forEach((t: any) => {
      if (t.status === 'done' && filter !== 'all') return;
      items.push({
        id: t.id || t._id,
        type: 'task',
        title: t.title,
        status: t.status,
        createdAt: t.createdAt || t.created_at,
        raw: t
      });
    });

    // 3. Process Meetings
    meetings.forEach((m: any) => {
      items.push({
        id: m.id || m._id,
        type: 'meeting',
        title: m.title,
        status: m.status,
        createdAt: m.createdAt || m.created_at || m.meeting_date,
        raw: m
      });
    });

    // 4. Process Projects
    projects.forEach((p: any) => {
      items.push({
        id: p.id || p._id,
        type: 'project',
        title: p.name,
        status: p.status,
        createdAt: p.createdAt || p.created_at,
        raw: p
      });
    });

    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || item.type === filter;
        return matchesSearch && matchesFilter;
      });
  }, [captures, tasks, meetings, projects, filter, search]);

  /* Mutations */
  const deleteCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Signal deletado', 'success'); },
  });

  const archiveCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processed' }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Signal arquivado', 'success'); },
  });

  const processAI = useMutation({
    mutationFn: () => apiFetch('/api/captures/bulk', { method: 'POST', body: JSON.stringify({ action: 'extract' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Processamento de IA concluído', 'success');
    },
  });

  const saveCapture = async () => {
    if (!captureText.trim()) return;
    try {
      await apiFetch('/api/captures', { method: 'POST', body: JSON.stringify({ content: captureText.trim(), type: 'note' }) });
      setCaptureText('');
      qc.invalidateQueries({ queryKey: ['captures'] });
      toast('Signal capturado', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const getPendingSignals = () => captures.filter((c: any) => c.status !== 'processed').length;

  return (
    <PageContainer className="pb-20">
      <Section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <Stack className="space-y-1">
            <Typography.Title className="text-5xl font-black tracking-tighter">Inbox</Typography.Title>
            <Typography.Label className="text-white/40 uppercase tracking-[0.3em] text-[10px]">
              {unifiedItems.length} Entradas Unificadas · {getPendingSignals()} Sinais Pendentes
            </Typography.Label>
          </Stack>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-2xl border-white/5 bg-white/5 hover:bg-white/10"
              onClick={() => processAI.mutate()}
              disabled={processAI.isPending || getPendingSignals() === 0}
            >
              {processAI.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {processAI.isPending ? 'Processando...' : 'Extrair com IA'}
            </Button>
          </div>
        </div>
      </Section>

      <Grid className="lg:grid-cols-[1fr_320px] items-start gap-10">
        {/* Main Feed */}
        <Stack className="space-y-6">
          {/* Controls Mobile */}
          <div className="flex flex-col gap-4 lg:hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar no Inbox..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/40 transition-premium"
              />
            </div>
          </div>

          <div className="space-y-4">
            {unifiedItems.length === 0 ? (
              <Panel className="glass-panel p-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/20">
                  <Archive className="w-8 h-8" />
                </div>
                <Typography.Label className="text-white/40 uppercase tracking-widest text-xs font-black">Inbox Vazio</Typography.Label>
                <Typography.Caption className="max-w-[200px]">Tudo limpo por aqui. Capture novos sinais ou tarefas para começar.</Typography.Caption>
              </Panel>
            ) : (
              unifiedItems.map((item) => (
                <InboxItemRow 
                  key={`${item.type}-${item.id}`} 
                  item={item} 
                  onArchive={() => archiveCapture.mutate(item.id)}
                  onDelete={() => deleteCapture.mutate(item.id)}
                />
              ))
            )}
          </div>
        </Stack>

        {/* Sidebar / Controls Desktop */}
        <Stack className="hidden lg:flex space-y-8 sticky top-8">
          {/* Search */}
          <Panel className="glass-panel p-6 space-y-4">
            <Typography.Label className="text-[10px] font-black uppercase tracking-widest text-white/30">Busca e Filtros</Typography.Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs focus:outline-none focus:border-primary/40 transition-premium"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {['all', 'task', 'meeting', 'project', 'link', 'note'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-premium border ${
                    filter === f 
                    ? 'bg-white text-black border-white' 
                    : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'
                  }`}
                >
                  {f === 'all' ? 'Ver Tudo' : typeConfig[f]?.label || f}
                </button>
              ))}
            </div>
          </Panel>

          {/* Quick Capture */}
          <Panel className="glass-panel p-6 space-y-4">
            <Typography.Label className="text-[10px] font-black uppercase tracking-widest text-white/30">Captura Rápida</Typography.Label>
            <textarea 
              value={captureText}
              onChange={e => setCaptureText(e.target.value)}
              placeholder="Capturar sinal..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs focus:outline-none focus:border-primary/40 transition-premium min-h-[100px] resize-none"
            />
            <Button 
              className="w-full rounded-xl bg-white text-black hover:bg-primary hover:text-white transition-premium"
              onClick={saveCapture}
              disabled={!captureText.trim()}
            >
              Capturar
            </Button>
          </Panel>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <Typography.Title className="text-xl font-black">{tasks.filter((t: any) => t.status !== 'done').length}</Typography.Title>
              <Typography.Label className="text-[9px] text-white/30 uppercase font-black tracking-widest">Tarefas</Typography.Label>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <Typography.Title className="text-xl font-black">{meetings.length}</Typography.Title>
              <Typography.Label className="text-[9px] text-white/30 uppercase font-black tracking-widest">Reuniões</Typography.Label>
            </div>
          </div>
        </Stack>
      </Grid>
    </PageContainer>
  );
}

function InboxItemRow({ item, onArchive, onDelete }: { item: UnifiedItem; onArchive: () => void; onDelete: () => void }) {
  const config = typeConfig[item.type] || typeConfig.note;
  const Icon = config.icon;

  return (
    <Panel className="glass-panel p-5 group hover:border-white/20 transition-premium interactive-scale">
      <div className="flex items-start gap-5">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 transition-premium group-hover:scale-110 group-hover:bg-white/5`}>
          <Icon className="w-5 h-5 text-white/40 group-hover:text-white transition-premium" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-3">
            <Badge variant={config.variant} className="text-[9px] uppercase tracking-widest px-2 py-0.5">
              {config.label}
            </Badge>
            <Typography.Caption className="text-[10px] text-white/20 font-black uppercase tracking-tighter">
              {timeAgo(item.createdAt)}
            </Typography.Caption>
          </div>
          
          <Typography.Title className="text-sm font-bold truncate group-hover:text-primary transition-colors">
            {item.title}
          </Typography.Title>

          {item.type === 'meeting' && item.raw?.meeting_date && (
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-medium">
              <Clock className="w-3 h-3" />
              {new Date(item.raw.meeting_date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {item.type === 'task' && item.raw?.due_date && (
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-medium">
              <Target className="w-3 h-3" />
              Prazo: {new Date(item.raw.due_date).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-premium">
          {item.type === 'note' || item.type === 'idea' || item.type === 'link' ? (
            <>
              <button 
                onClick={onArchive}
                className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:bg-white hover:text-black transition-premium"
                title="Arquivar"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button 
                onClick={onDelete}
                className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-premium"
                title="Deletar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-premium"
              title="Abrir"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

