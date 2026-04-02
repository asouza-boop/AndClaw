import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { Archive, CheckCircle2 } from 'lucide-react';

export default function ArchivePage() {
  const { data: captures = [] } = useQuery({
    queryKey: ['captures-archive'],
    queryFn: () => apiFetch('/api/captures?status=processed').then(ensureArray),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-archive'],
    queryFn: () => apiFetch('/api/tasks?status=done').then(ensureArray),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Arquivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Itens processados e tarefas concluídas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Archive className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Capturas processadas</h2>
          </div>
          <div className="space-y-3">
            {captures.map((item: any) => (
              <div key={item.id} className="rounded-lg bg-surface-2 border border-border p-3">
                <p className="text-sm">{item.content}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.type || 'note'}</p>
              </div>
            ))}
            {captures.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma captura arquivada.</p>}
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <h2 className="text-sm font-semibold">Tarefas concluídas</h2>
          </div>
          <div className="space-y-3">
            {tasks.map((task: any) => (
              <div key={task.id} className="rounded-lg bg-surface-2 border border-border p-3">
                <p className="text-sm">{task.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{task.priority || 'normal'}</p>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa concluída.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
