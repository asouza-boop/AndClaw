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
    const due = t.dueDate || t.due_date;
    if (!due) return false;
    return new Date(due).toDateString() === new Date().toDateString();
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

  const processAI = useMutation({
    mutationFn: () => apiFetch('/api/captures/bulk', { method: 'POST', body: JSON.stringify({ action: 'extract' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['memory'] });
      toast('Processamento concluído pelo Agente', 'success');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

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
    <div className="p-8 space-y-10 animate-in fade-in duration-700 max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row gap-8 px-4">
        {/* Left - Captures */}
        <div className="flex-[7] space-y-8">
          {/* Header & Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-black text-white tracking-tighter">Inbox</h1>
              <span className="text-[10px] font-black text-white/20 bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-widest font-mono">
                {unprocessed.length} Nodes
              </span>
            </div>
            <div className="flex gap-1.5 p-1.5 bg-black/20 rounded-2xl border border-white/5 backdrop-blur-md">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-premium ${filter === f.value ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Banner */}
          {unprocessed.length > 0 && (
            <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20 shadow-2xl shadow-primary/5 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                  <Sparkles className={`w-6 h-6 ${processAI.isPending ? 'animate-spin' : 'animate-pulse'}`} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Cognitive Extraction Available</h3>
                  <p className="text-[11px] text-white/40 font-medium">{unprocessed.length} pending fragments awaiting intelligent organization.</p>
                </div>
              </div>
              <button 
                onClick={() => processAI.mutate()}
                disabled={processAI.isPending}
                className="px-6 py-3 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white disabled:opacity-50 transition-premium flex items-center gap-2 shadow-xl shadow-white/5 interactive-scale"
              >
                {processAI.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {processAI.isPending ? 'Syncing...' : 'Extract with AI'}
              </button>
            </div>
          )}

          {/* Capture panel */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex gap-2 p-1.5 bg-black/20 rounded-2xl border border-white/5 w-fit">
              {['note', 'task', 'idea', 'link'].map((t) => (
                <button
                  key={t}
                  onClick={() => setCaptureType(t)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-premium ${captureType === t ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}
                >
                  {t === 'note' ? 'Note' : t === 'task' ? 'Task' : t === 'idea' ? 'Idea' : 'Link'}
                </button>
              ))}
            </div>
            <textarea
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              placeholder="Inject raw data for cognitive processing..."
              rows={3}
              className="w-full px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-[15px] text-white placeholder:text-white/10 focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-premium resize-none font-medium"
            />
            <div className="flex justify-end">
              <button 
                onClick={saveCapture} 
                disabled={!captureText.trim()} 
                className="px-8 py-3 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white disabled:opacity-20 transition-premium shadow-xl interactive-scale"
              >
                Capture Signal
              </button>
            </div>
          </div>

          {/* Signal Stream */}
          <div className="space-y-10">
            {filteredUnprocessed.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase mb-6 font-mono px-2">Unprocessed Signal Stream</h3>
                <div className="space-y-4">
                  {filteredUnprocessed.map((c: any) => (
                    <div key={c._id || c.id} className="group flex items-start gap-5 p-5 rounded-2xl glass-card-v2 interactive-scale">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-white/80 leading-relaxed mb-3">{c.content}</p>
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-black tracking-widest px-2.5 py-1 rounded-lg border ${typeColors[c.type] || typeColors.note} uppercase`}>
                            {typeLabels[c.type] || 'Note'}
                          </span>
                          <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">{timeAgo(c.createdAt || c.created_at || new Date().toISOString())}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-premium shrink-0 scale-95 group-hover:scale-100">
                        <button onClick={() => convertToTask.mutate(c)} className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-white transition-premium" title="Convert to Task">
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <button onClick={() => archiveCapture.mutate(c._id || c.id)} className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-premium" title="Archive Signal">
                          <Archive className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteCapture.mutate(c._id || c.id)} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-premium" title="Delete Signal">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredProcessed.length > 0 && (
              <div className="opacity-40">
                <h3 className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase mb-6 font-mono px-2">Processed Archives</h3>
                <div className="space-y-4">
                  {filteredProcessed.map((c: any) => (
                    <div key={c._id || c.id} className="flex items-start gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-white/40 line-through leading-relaxed mb-3">{c.content}</p>
                        <span className={`text-[9px] font-black tracking-widest px-2.5 py-1 rounded-lg border ${typeColors[c.type] || typeColors.note} uppercase opacity-60`}>
                          {typeLabels[c.type] || 'Note'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right - Operations Deck */}
        <div className="flex-[3] space-y-8 lg:sticky lg:top-8 self-start">
          <div className="glass-panel p-8 bg-black/60 shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 font-mono">Operations Deck</h3>
            </div>

            {/* New Signal Target */}
            <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10 mb-8 focus-within:border-primary/40 transition-premium group">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTask()}
                placeholder="New Operation Marker..."
                className="flex-1 px-4 py-2.5 bg-transparent text-[13px] text-white placeholder:text-white/10 focus:outline-none font-medium"
              />
              <button 
                onClick={createTask}
                className="w-10 h-10 rounded-xl bg-white/5 text-white/20 hover:bg-primary hover:text-white transition-premium flex items-center justify-center interactive-scale"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Signal Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="text-center p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-2xl font-black text-white tracking-tighter mb-0.5">{pendingTasks.length}</p>
                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Open</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <p className="text-2xl font-black text-primary tracking-tighter mb-0.5">{todayTasks.length}</p>
                <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Current</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-2xl font-black text-white/20 tracking-tighter mb-0.5">{doneTasks.length}</p>
                <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Synced</p>
              </div>
            </div>

            {/* Operation Stream */}
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 scrollbar-hide">
              {pendingTasks
                .sort((a: any, b: any) => {
                  const order: Record<string, number> = { high: 0, normal: 1, low: 2 };
                  return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
                })
                .map((t: any) => (
                  <div key={t._id || t.id} className="group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-primary/20 transition-premium interactive-scale">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-white/20 shrink-0 group-hover:border-primary group-hover:bg-primary/20 transition-premium shadow-[0_0_8px_rgba(168,85,247,0)] group-hover:shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                    <span className="text-[13px] font-medium text-white/70 flex-1 truncate group-hover:text-white transition-colors">{t.title}</span>
                    <span className={`text-[8px] font-black tracking-[0.2em] px-2 py-0.5 rounded-lg border shrink-0 uppercase ${priorityColors[t.priority] || priorityColors.normal}`}>
                      {priorityLabels[t.priority] || 'NML'}
                    </span>
                    <button
                      onClick={() => deleteTask.mutate(t._id || t.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-premium transform translate-x-4 group-hover:translate-x-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
