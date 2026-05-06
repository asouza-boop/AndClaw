import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Archive, CheckCircle2, Search, RotateCcw, Inbox, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';

const typeLabels: Record<string, string> = { note: 'Nota', task: 'Tarefa', idea: 'Ideia', link: 'Link' };
const typeVariants: Record<string, "primary" | "secondary" | "warning" | "success" | "info"> = {
  note: 'warning',
  task: 'secondary',
  idea: 'primary',
  link: 'info',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ArchivePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'captures' | 'tasks'>('captures');

  const { data: captures = [], isLoading: loadingCaptures } = useQuery({
    queryKey: ['captures-archive'],
    queryFn: () => apiFetch('/api/captures?status=archived').then(ensureArray),
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks-archive'],
    queryFn: () => apiFetch('/api/tasks?status=done').then(ensureArray),
  });

  const restoreCapture = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/captures/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'new' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captures-archive'] });
      qc.invalidateQueries({ queryKey: ['captures'] });
      toast('Item restaurado para o inbox.', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const reopenTask = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'open' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-archive'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast('Tarefa reaberta.', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const filteredCaptures = captures.filter((c: any) =>
    !search || (c.content || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredTasks = tasks.filter((t: any) =>
    !search || (t.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const loading = loadingCaptures || loadingTasks;

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Arquivo" 
        subtitle="Capturas arquivadas e tarefas concluídas"
        actions={
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <Button
              variant={tab === 'captures' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab('captures')}
              style={{ borderRadius: 0, border: 'none', fontSize: '11px', textTransform: 'uppercase' }}
            >
              Capturas <span style={{ marginLeft: 'var(--space-2)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>({filteredCaptures.length})</span>
            </Button>
            <Button
              variant={tab === 'tasks' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab('tasks')}
              style={{ borderRadius: 0, border: 'none', fontSize: '11px', textTransform: 'uppercase' }}
            >
              Tarefas <span style={{ marginLeft: 'var(--space-2)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>({filteredTasks.length})</span>
            </Button>
          </div>
        }
      />

      <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-6)' }}>
          <Card padding="lg" border shadow="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                <Archive size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Arquivados</span>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-black)', fontFamily: 'var(--font-mono)' }}>{captures.length}</span>
              </div>
            </div>
          </Card>
          <Card padding="lg" border shadow="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Concluídos</span>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-black)', fontFamily: 'var(--font-mono)' }}>{tasks.length}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div style={{ maxWidth: '400px' }}>
          <Input 
            placeholder="Buscar no arquivo..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            icon={<Search size={16} />}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-20)', gap: 'var(--space-4)' }}>
            <Loader2 size={32} className="animate-spin text-primary" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Indexando Histórico...</span>
          </div>
        ) : tab === 'captures' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredCaptures.length === 0 ? (
              <EmptyState 
                icon={<Archive size={48} />}
                title={search ? "Nenhum resultado" : "Arquivo Vazio"}
                description={search ? "Tente outros termos de busca." : "Suas capturas arquivadas aparecerão aqui."}
              />
            ) : filteredCaptures.map((item: any) => (
              <Card key={item.id} padding="md" border shadow="none" className="group">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', margin: 0, lineHeight: 1.5 }}>{item.content}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                      <Badge variant={typeVariants[item.type] || 'primary'} style={{ fontSize: '9px' }}>
                        {typeLabels[item.type] || 'Nota'}
                      </Badge>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{timeAgo(item.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => restoreCapture.mutate(String(item.id))}
                    className="opacity-0 group-hover:opacity-100"
                    style={{ fontSize: '10px' }}
                  >
                    <Inbox size={12} className="mr-2" /> Restaurar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredTasks.length === 0 ? (
              <EmptyState 
                icon={<CheckCircle2 size={48} />}
                title={search ? "Nenhum resultado" : "Histórico de Tarefas Vazio"}
                description={search ? "Tente outros termos de busca." : "Suas tarefas concluídas aparecerão aqui."}
              />
            ) : filteredTasks.map((task: any) => (
              <Card key={task.id} padding="md" border shadow="none" className="group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', margin: 0, textDecoration: 'line-through', color: 'var(--color-text-tertiary)' }}>{task.title}</p>
                    <div style={{ marginTop: 'var(--space-1)' }}>
                      <Badge variant={task.priority === 'high' ? 'danger' : 'ghost'} style={{ fontSize: '9px' }}>
                        {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baixa' : 'Normal'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reopenTask.mutate(String(task.id))}
                    className="opacity-0 group-hover:opacity-100"
                    style={{ fontSize: '10px' }}
                  >
                    <RotateCcw size={12} className="mr-2" /> Reabrir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

