import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Archive, CheckCircle2, Search, RotateCcw, Inbox } from 'lucide-react';

const typeLabels: Record<string, string> = { note: 'Nota', task: 'Tarefa', idea: 'Ideia', link: 'Link' };
const typeColors: Record<string, string> = {
  note: 'bg-warn/10 text-warn border-warn/20',
  task: 'bg-accent/10 text-accent border-accent/20',
  idea: 'bg-primary/10 text-primary border-primary/20',
  link: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Arquivo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capturas arquivadas e tarefas concluídas.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface glow-border p-4 flex items-center gap-3">
          <Archive className="w-5 h-5 text-primary/70" />
          <div>
            <p className="text-xl font-semibold">{captures.length}</p>
            <p className="text-xs text-muted-foreground">Capturas arquivadas</p>
          </div>
        </div>
        <div className="rounded-xl bg-surface glow-border p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success/70" />
          <div>
            <p className="text-xl font-semibold">{tasks.length}</p>
            <p className="text-xs text-muted-foreground">Tarefas concluídas</p>
          </div>
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar no arquivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-white/[0.07] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/[0.07]">
          <button
            onClick={() => setTab('captures')}
            className={`px-4 py-2 text-sm transition-colors ${tab === 'captures' ? 'bg-primary/15 text-primary' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
          >
            Capturas ({filteredCaptures.length})
          </button>
          <button
            onClick={() => setTab('tasks')}
            className={`px-4 py-2 text-sm transition-colors ${tab === 'tasks' ? 'bg-primary/15 text-primary' : 'bg-surface text-muted-foreground hover:text-foreground'}`}
          >
            Tarefas ({filteredTasks.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : tab === 'captures' ? (
        <div className="space-y-2">
          {filteredCaptures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? 'Nenhuma captura encontrada.' : 'Nenhuma captura arquivada.'}
            </div>
          ) : filteredCaptures.map((item: any) => (
            <div key={item.id} className="flex items-start gap-3 rounded-xl bg-surface glow-border p-4 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm">{item.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeColors[item.type] || typeColors.note}`}>
                    {typeLabels[item.type] || 'Nota'}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => restoreCapture.mutate(String(item.id))}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-md bg-surface-3 text-xs text-muted-foreground hover:text-foreground transition-all"
              >
                <Inbox className="w-3 h-3" />
                Restaurar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? 'Nenhuma tarefa encontrada.' : 'Nenhuma tarefa concluída.'}
            </div>
          ) : filteredTasks.map((task: any) => (
            <div key={task.id} className="flex items-center gap-3 rounded-xl bg-surface glow-border p-4 group">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm line-through text-muted-foreground">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    task.priority === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                    task.priority === 'low' ? 'bg-surface-3 text-muted-foreground border-white/10' :
                    'bg-accent/10 text-accent border-accent/20'
                  }`}>
                    {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baixa' : 'Normal'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => reopenTask.mutate(String(task.id))}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-md bg-surface-3 text-xs text-muted-foreground hover:text-foreground transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Reabrir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
