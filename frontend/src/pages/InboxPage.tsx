import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useMemo } from 'react';
import { 
  Trash2, CheckSquare, Archive, Loader2, Sparkles, 
  Calendar, FolderKanban, MessageSquare, Link as LinkIcon,
  Search, ChevronRight, Clock, Target
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';

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

const typeConfig: Record<string, { label: string; icon: any; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  task: { label: 'Tarefa', icon: CheckSquare, variant: 'success' },
  meeting: { label: 'Reunião', icon: Calendar, variant: 'info' },
  project: { label: 'Projeto', icon: FolderKanban, variant: 'warning' },
  link: { label: 'Link', icon: LinkIcon, variant: 'default' },
  note: { label: 'Nota', icon: MessageSquare, variant: 'default' },
  idea: { label: 'Ideia', icon: Sparkles, variant: 'default' },
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
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Inbox" 
        subtitle={`${unifiedItems.length} Entradas Unificadas · ${getPendingSignals()} Sinais Pendentes`}
        actions={
          <Button 
            variant="primary"
            onClick={() => processAI.mutate()}
            disabled={processAI.isPending || getPendingSignals() === 0}
          >
            {processAI.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {processAI.isPending ? 'Processando...' : 'Extrair com IA'}
          </Button>
        }
      />

      <div style={{ marginTop: 'var(--space-8)', display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-8)' }} className="lg:grid-cols-[1fr_320px]">
        {/* Main Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Controls Mobile */}
          <div className="lg:hidden">
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar no Inbox..."
              className="w-full"
            />
          </div>

          <div className="animate-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {unifiedItems.length === 0 ? (
              <EmptyState 
                icon={<Archive size={40} />}
                title="Inbox Vazio"
                description="Tudo limpo por aqui. Capture novos sinais ou tarefas para começar."
              />
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
        </div>

        {/* Sidebar / Controls Desktop */}
        <aside className="hidden lg:flex flex-col gap-var(--space-8) sticky top-8">
          <Card padding="md" border shadow="sm">
            <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
              Busca e Filtros
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full"
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {['all', 'task', 'meeting', 'project', 'link', 'note'].map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter(f)}
                    style={{ fontSize: '10px', textTransform: 'uppercase' }}
                  >
                    {f === 'all' ? 'Ver Tudo' : typeConfig[f]?.label || f}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          <Card padding="md" border shadow="sm" style={{ marginTop: 'var(--space-8)' }}>
            <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
              Captura Rápida
            </h4>
            <textarea 
              value={captureText}
              onChange={e => setCaptureText(e.target.value)}
              placeholder="Capturar sinal..."
              style={{
                width: '100%',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                minHeight: '100px',
                resize: 'none',
                outline: 'none',
                marginBottom: 'var(--space-4)',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <Button 
              className="w-full"
              onClick={saveCapture}
              disabled={!captureText.trim()}
            >
              Capturar
            </Button>
          </Card>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-8)' }}>
            <Card padding="sm" border shadow="none" style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', fontFamily: 'var(--font-mono)' }}>
                {tasks.filter((t: any) => t.status !== 'done').length}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Tarefas</span>
            </Card>
            <Card padding="sm" border shadow="none" style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', fontFamily: 'var(--font-mono)' }}>
                {meetings.length}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Reuniões</span>
            </Card>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

/* Badge color map for v3 palette */
const inboxBadgeStyle: Record<string, React.CSSProperties> = {
  idea:    { backgroundColor: 'var(--color-accent-sub)',  color: 'var(--color-accent)' },
  meeting: { backgroundColor: '#1E3A2F',                   color: 'var(--color-teal)' },
  note:    { backgroundColor: 'var(--color-bg-elevated)',  color: 'var(--color-text-tertiary)' },
  task:    { backgroundColor: '#2D1F4E',                   color: 'var(--color-purple)' },
  link:    { backgroundColor: 'var(--color-bg-elevated)',  color: 'var(--color-text-tertiary)' },
  project: { backgroundColor: '#2D2410',                   color: 'var(--color-warning)' },
};

function InboxItemRow({ item, onArchive, onDelete }: { item: UnifiedItem; onArchive: () => void; onDelete: () => void }) {
  const config = typeConfig[item.type] || typeConfig.note;
  const Icon = config.icon;
  const badgeStyle = inboxBadgeStyle[item.type] || inboxBadgeStyle.note;

  return (
    <Card padding="sm" border shadow="none" animate={false} className="group inbox-item-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Icon badge */}
        <div style={{ 
          width: '36px', 
          height: '36px', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: badgeStyle.backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: badgeStyle.color,
          flexShrink: 0,
        }}>
          <Icon size={16} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{
              ...badgeStyle,
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              padding: '1px 7px',
              borderRadius: 'var(--radius-full)',
            }}>
              {config.label}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', marginLeft: '4px' }}>
              {timeAgo(item.createdAt)}
            </span>
          </div>

          {/* Title */}
          <p style={{ 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-normal)', 
            color: 'var(--color-text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: '2px',
          }}>
            {item.title}
          </p>

          {/* Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {item.type === 'meeting' && item.raw?.meeting_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                <Clock size={11} />
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {new Date(item.raw.meeting_date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {item.type === 'task' && item.raw?.due_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                <Target size={11} />
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {new Date(item.raw.due_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions — visible on parent hover only */}
        <div
          className="inbox-actions"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', opacity: 0, transition: 'opacity var(--t-fast)' }}
        >
          {item.type === 'note' || item.type === 'idea' || item.type === 'link' ? (
            <>
              <Button variant="ghost" size="sm" onClick={onArchive} title="Arquivar">
                <Archive size={15} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--color-error)' }} title="Deletar">
                <Trash2 size={15} />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" title="Abrir">
              <ChevronRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}


