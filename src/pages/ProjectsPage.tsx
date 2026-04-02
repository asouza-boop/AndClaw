import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, GripVertical, MoreHorizontal, Clock, User, Zap, Bot,
  ChevronRight, FolderKanban, List, Search, X, CheckCircle2,
  ArrowRight, Calendar, Tag, Loader2, AlertCircle
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

/* ─── types ─── */
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  agent_id?: string;
  skill_ids?: string[];
  due_date?: string;
  tags?: string[];
  created_at?: string;
  project_id?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at?: string;
}

const COLUMNS: { key: Task['status']; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'text-muted-foreground' },
  { key: 'todo', label: 'A Fazer', color: 'text-accent' },
  { key: 'in_progress', label: 'Em Progresso', color: 'text-primary' },
  { key: 'review', label: 'Revisão', color: 'text-warn' },
  { key: 'done', label: 'Concluído', color: 'text-success' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-accent/20 text-accent',
  high: 'bg-warn/20 text-warn',
  urgent: 'bg-destructive/20 text-destructive',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};

const PROJECT_COLORS = [
  'hsl(263 84% 66%)', 'hsl(187 90% 53%)', 'hsl(160 60% 40%)',
  'hsl(38 92% 50%)', 'hsl(347 77% 50%)', 'hsl(200 70% 50%)',
];

/* ─── component ─── */
export default function ProjectsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [taskDialog, setTaskDialog] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({ status: 'todo', priority: 'medium' });
  const [newProject, setNewProject] = useState<Partial<Project>>({ color: PROJECT_COLORS[0] });
  const dragItem = useRef<string | null>(null);

  /* queries */
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiFetch('/api/projects').then(ensureArray),
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', selectedProject],
    queryFn: () => {
      const url = selectedProject === 'all' ? '/api/tasks' : `/api/tasks?project_id=${selectedProject}`;
      return apiFetch(url).then(ensureArray);
    },
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['agents'],
    queryFn: () => apiFetch('/api/agents').then(ensureArray),
  });

  const { data: skills = [] } = useQuery<any[]>({
    queryKey: ['skills'],
    queryFn: () => apiFetch('/api/skills').then(ensureArray),
  });

  /* mutations */
  const saveMut = useMutation({
    mutationFn: (t: Partial<Task>) =>
      t.id
        ? apiFetch(`/api/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify(t) })
        : apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(t) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setTaskDialog(false); setEditingTask(null); setNewTask({ status: 'todo', priority: 'medium' }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const projectMut = useMutation({
    mutationFn: (p: Partial<Project>) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setProjectDialog(false); setNewProject({ color: PROJECT_COLORS[0] }); },
  });

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    saveMut.mutate({ id: taskId, status: newStatus });
  };

  /* filtered tasks */
  const filtered = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (t: Task) => { setEditingTask(t); setNewTask(t); setTaskDialog(true); };
  const openNew = (status?: Task['status']) => { setEditingTask(null); setNewTask({ status: status || 'todo', priority: 'medium', project_id: selectedProject === 'all' ? undefined : selectedProject }); setTaskDialog(true); };

  const taskForm = editingTask ? { ...newTask } : newTask;

  return (
    <div className="space-y-4 pb-6">
      {/* header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[Outfit] flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" /> Projetos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{tasks.length} tarefas · {projects.length} projetos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setProjectDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Projeto
          </Button>
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="h-4 w-4 mr-1" /> Tarefa
          </Button>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefas…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color || PROJECT_COLORS[0] }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border border-border rounded-md overflow-hidden">
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm transition-colors ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
            <FolderKanban className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : view === 'kanban' ? (
        /* ─── KANBAN ─── */
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key);
            return (
              <div
                key={col.key}
                className="flex-shrink-0 w-[260px] bg-secondary/30 rounded-lg border border-border/50"
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragItem.current) moveTask(dragItem.current, col.key); dragItem.current = null; }}
              >
                <div className="flex items-center justify-between p-3 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">{colTasks.length}</Badge>
                  </div>
                  <button onClick={() => openNew(col.key)} className="text-muted-foreground hover:text-foreground">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agents={agents}
                      skills={skills}
                      projects={projects}
                      onEdit={() => openEdit(task)}
                      onDelete={() => deleteMut.mutate(task.id)}
                      onDragStart={() => { dragItem.current = task.id; }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── LIST ─── */
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">Nenhuma tarefa encontrada</div>
              )}
              {filtered.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => openEdit(task)}>
                  <StatusDot status={task.status} />
                  <span className="flex-1 text-sm font-medium truncate">{task.title}</span>
                  <Badge className={`text-xs ${PRIORITY_COLORS[task.priority || 'medium']}`}>{PRIORITY_LABELS[task.priority || 'medium']}</Badge>
                  {task.agent_id && <Bot className="h-4 w-4 text-accent" />}
                  {task.skill_ids?.length ? <Zap className="h-4 w-4 text-primary" /> : null}
                  {task.due_date && <span className="text-xs text-muted-foreground">{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TASK DIALOG ─── */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título da tarefa" value={taskForm.title || ''} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="Descrição (opcional)" value={taskForm.description || ''} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={taskForm.status || 'todo'} onValueChange={v => setNewTask(p => ({ ...p, status: v as Task['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={taskForm.priority || 'medium'} onValueChange={v => setNewTask(p => ({ ...p, priority: v as Task['priority'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Projeto</label>
                <Select value={taskForm.project_id || 'none'} onValueChange={v => setNewTask(p => ({ ...p, project_id: v === 'none' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data limite</label>
                <Input type="date" value={taskForm.due_date || ''} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            {/* Agent */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Bot className="h-3 w-3" /> Agente responsável</label>
              <Select value={taskForm.agent_id || 'none'} onValueChange={v => setNewTask(p => ({ ...p, agent_id: v === 'none' ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Sem agente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem agente</SelectItem>
                  {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name || a.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Skills */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Zap className="h-3 w-3" /> Skills vinculadas</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {skills.map((s: any) => {
                  const active = taskForm.skill_ids?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setNewTask(p => {
                        const ids = p.skill_ids || [];
                        return { ...p, skill_ids: active ? ids.filter(i => i !== s.id) : [...ids, s.id] };
                      })}
                      className={`px-2 py-1 rounded-md text-xs border transition-colors ${active ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      {s.name || s.title || s.slug}
                    </button>
                  );
                })}
                {skills.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma skill disponível</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            {editingTask && (
              <Button variant="destructive" size="sm" onClick={() => { deleteMut.mutate(editingTask.id); setTaskDialog(false); }}>Excluir</Button>
            )}
            <Button onClick={() => saveMut.mutate(taskForm)} disabled={!taskForm.title || saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingTask ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── PROJECT DIALOG ─── */}
      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do projeto" value={newProject.name || ''} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} />
            <Textarea placeholder="Descrição (opcional)" value={newProject.description || ''} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} rows={2} />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewProject(p => ({ ...p, color: c }))}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${newProject.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => projectMut.mutate(newProject)} disabled={!newProject.name || projectMut.isPending}>
              {projectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── sub-components ─── */
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    backlog: 'bg-muted-foreground', todo: 'bg-accent', in_progress: 'bg-primary',
    review: 'bg-warn', done: 'bg-success',
  };
  return <span className={`h-2 w-2 rounded-full ${colors[status] || 'bg-muted'}`} />;
}

function TaskCard({ task, agents, skills, projects, onEdit, onDelete, onDragStart }: {
  task: Task; agents: any[]; skills: any[]; projects: Project[];
  onEdit: () => void; onDelete: () => void; onDragStart: () => void;
}) {
  const agent = agents.find(a => a.id === task.agent_id);
  const project = projects.find(p => p.id === task.project_id);
  const taskSkills = skills.filter(s => task.skill_ids?.includes(s.id));

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-card border border-border/60 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        <span className="flex-1 text-sm font-medium leading-tight cursor-pointer" onClick={onEdit}>{task.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority || 'medium']}`}>
          {PRIORITY_LABELS[task.priority || 'medium']}
        </Badge>
        {project && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color || PROJECT_COLORS[0] }} />
            {project.name}
          </span>
        )}
        {agent && (
          <span className="flex items-center gap-0.5 text-[10px] text-accent" title={agent.name || agent.title}>
            <Bot className="h-3 w-3" />
          </span>
        )}
        {taskSkills.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-primary" title={taskSkills.map(s => s.name || s.slug).join(', ')}>
            <Zap className="h-3 w-3" /> {taskSkills.length}
          </span>
        )}
        {task.due_date && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
            <Calendar className="h-3 w-3" />
            {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
