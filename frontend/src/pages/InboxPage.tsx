import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Trash2, CheckSquare, Archive, Loader2, Sparkles, Plus } from 'lucide-react';

const typeColors: Record<string, string> = {
  note: 'bg-warn/10 text-warn border-warn/20',
  task: 'bg-accent/10 text-accent border-accent/20',
  idea: 'bg-primary/10 text-primary border-primary/20',
  link: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};
const typeLabels: Record<string, string> = { note: 'Nota', task: 'Tarefa', idea: 'Ideia', link: 'Link' };
const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  normal: 'bg-accent/10 text-accent border-accent/20',
  low: 'bg-surface-3 text-muted-foreground',
};
const priorityLabels: Record<string, string> = { high: 'Alta', normal: 'Normal', low: 'Baixa' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

export default function InboxPage() {
  const qc = useQueryClient();
  const { data: captures = [] } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => apiFetch('/api/tasks').then(ensureArray) });

  const [filter, setFilter] = useState('all');
  const [captureType, setCaptureType] = useState('note');
  const [captureText, setCaptureText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('normal');

  const unprocessed = captures.filter((c: any) => c.status !== 'processed');
  const processed = captures.filter((c: any) => c.status === 'processed');
  const filtered = filter === 'all' ? captures : captures.filter((c: any) => c.type === filter);
  const filteredUnprocessed = filtered.filter((c: any) => c.status !== 'processed');
  const filteredProcessed = filtered.filter((c: any) => c.status === 'processed');

  const pendingTasks = tasks.filter((t: any) => t.status !== 'done');
  const todayTasks = tasks.filter((t: any) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate).toDateString() === new Date().toDateString();
  });
  const doneTasks = tasks.filter((t: any) => t.status === 'done');

  const deleteCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Item excluído', 'success'); },
  });

  const convertToTask = useMutation({
    mutationFn: async (capture: any) => {
      await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title: capture.content, priority: 'normal' }) });
      await apiFetch(`/api/captures/${capture._id || capture.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processed' }) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); toast('Convertido em tarefa', 'success'); },
  });

  const archiveCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processed' }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Arquivado', 'success'); },
  });

  const saveCapture = async () => {
    if (!captureText.trim()) return;
    try {
      await apiFetch('/api/captures', { method: 'POST', body: JSON.stringify({ content: captureText.trim(), type: captureType }) });
      setCaptureText('');
      qc.invalidateQueries({ queryKey: ['captures'] });
      toast('Captura salva', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title: newTaskTitle.trim(), priority: newTaskPriority }) });
      setNewTaskTitle('');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast('Tarefa criada', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const deleteTask = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast('Tarefa excluída', 'success'); },
  });

  const filters = [
    { value: 'all', label: 'Todos' },
    { value: 'task', label: 'Tarefas' },
    { value: 'note', label: 'Notas' },
    { value: 'idea', label: 'Ideias' },
    { value: 'link', label: 'Links' },
  ];

  return (
    <div className="flex gap-6 max-w-7xl">
      {/* Left - Captures */}
      <div className="flex-[7] space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Inbox</h2>
            <span className="text-xs text-muted-foreground bg-surface-3 px-2 py-0.5 rounded-md">{unprocessed.length} itens</span>
          </div>
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${filter === f.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Banner */}
        {unprocessed.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{unprocessed.length} itens para processar</span>
            </div>
            <button className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
              Processar com IA
            </button>
          </div>
        )}

        {/* Capture panel */}
        <div className="rounded-xl bg-surface glow-border p-4 space-y-3">
          <div className="flex gap-2">
            {['note', 'task', 'idea', 'link'].map((t) => (
              <button
                key={t}
                onClick={() => setCaptureType(t)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${captureType === t ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'note' ? '📝 Nota' : t === 'task' ? '✓ Tarefa' : t === 'idea' ? '💡 Ideia' : '🔗 Link'}
              </button>
            ))}
          </div>
          <textarea
            value={captureText}
            onChange={(e) => setCaptureText(e.target.value)}
            placeholder="O que você quer capturar?"
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
          <div className="flex justify-end">
            <button onClick={saveCapture} disabled={!captureText.trim()} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50">
              Salvar
            </button>
          </div>
        </div>

        {/* Unprocessed */}
        {filteredUnprocessed.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-2">Não processados</p>
            <div className="space-y-2">
              {filteredUnprocessed.map((c: any) => (
                <div key={c._id || c.id} className="group flex items-start gap-3 p-3 rounded-lg bg-surface glow-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{c.content}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[c.type] || typeColors.note}`}>
                        {typeLabels[c.type] || 'Nota'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt || c.created_at || new Date().toISOString())}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => convertToTask.mutate(c)} className="p-1.5 rounded-md hover:bg-surface-3 text-accent" title="Converter em tarefa">
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => archiveCapture.mutate(c._id || c.id)} className="p-1.5 rounded-md hover:bg-surface-3 text-muted-foreground" title="Arquivar">
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteCapture.mutate(c._id || c.id)} className="p-1.5 rounded-md hover:bg-surface-3 text-destructive" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processed */}
        {filteredProcessed.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-2">Processados</p>
            <div className="space-y-2">
              {filteredProcessed.map((c: any) => (
                <div key={c._id || c.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface/50 opacity-60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-through">{c.content}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[c.type] || typeColors.note}`}>
                      {typeLabels[c.type] || 'Nota'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right - Tasks */}
      <div className="flex-[3] space-y-4 sticky top-6 self-start">
        <div className="rounded-xl bg-surface glow-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Tarefas</h3>
          </div>

          {/* New task */}
          <div className="flex gap-2 mb-4">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTask()}
              placeholder="+ Nova tarefa..."
              className="flex-1 px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 rounded-md bg-surface-2">
              <p className="text-lg font-semibold">{pendingTasks.length}</p>
              <p className="text-[10px] text-muted-foreground">abertas</p>
            </div>
            <div className="text-center p-2 rounded-md bg-surface-2">
              <p className="text-lg font-semibold">{todayTasks.length}</p>
              <p className="text-[10px] text-muted-foreground">hoje</p>
            </div>
            <div className="text-center p-2 rounded-md bg-surface-2">
              <p className="text-lg font-semibold">{doneTasks.length}</p>
              <p className="text-[10px] text-muted-foreground">concluídas</p>
            </div>
          </div>

          {/* Task list */}
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {pendingTasks
              .sort((a: any, b: any) => {
                const order: Record<string, number> = { high: 0, normal: 1, low: 2 };
                return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
              })
              .map((t: any) => (
                <div key={t._id || t.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-surface-3 transition-colors">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                  <span className="text-sm flex-1 truncate">{t.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${priorityColors[t.priority] || priorityColors.normal}`}>
                    {priorityLabels[t.priority] || 'Normal'}
                  </span>
                  <button
                    onClick={() => deleteTask.mutate(t._id || t.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
