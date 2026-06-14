import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Plus, GripVertical, MoreHorizontal, Clock, Bot, Zap,
  FolderKanban, List, Search, X, CheckCircle2,
  Calendar, Loader2, Target
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ProjectsSkeleton } from '@/components/PageSkeletons';

/* ─── types ─── */
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
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

const COLUMNS: { key: Task['status']; label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }[] = [
  { key: 'backlog', label: 'Backlog', variant: 'default' },
  { key: 'todo', label: 'A Fazer', variant: 'info' },
  { key: 'in_progress', label: 'Em Execução', variant: 'warning' },
  { key: 'review', label: 'Revisão', variant: 'default' },
  { key: 'done', label: 'Concluído', variant: 'success' },
  { key: 'cancelled', label: 'Cancelado', variant: 'error' },
];

const PRIORITY_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  low: { label: 'Baixa', variant: 'default' },
  medium: { label: 'Média', variant: 'info' },
  high: { label: 'Alta', variant: 'warning' },
  urgent: { label: 'Urgente', variant: 'error' },
};

const PROJECT_COLORS = [
  'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)',
  'var(--color-info)', 'var(--color-error)', 'var(--color-text-secondary)',
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
    onError: (err: any) => toast(err.message || 'Erro ao salvar tarefa', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: any) => toast(err.message || 'Erro ao excluir tarefa', 'error'),
  });

  const projectMut = useMutation({
    mutationFn: (p: Partial<Project>) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setProjectDialog(false); setNewProject({ color: PROJECT_COLORS[0] }); },
    onError: (err: any) => toast(err.message || 'Erro ao criar projeto', 'error'),
  });

  const executeSkillsMut = useMutation({
    mutationFn: async ({ task, agentName, skillNames }: { task: Task; agentName: string; skillNames: string[] }) => {
      const skillIds = task.skill_ids || [];
      const results = await Promise.allSettled(
        skillIds.map(skillId =>
          apiFetch(`/api/agents/${task.agent_id}/execute`, {
            method: 'POST',
            body: JSON.stringify({
              skill_id: skillId,
              task_id: task.id,
              task_title: task.title,
              task_description: task.description || '',
            }),
          })
        )
      );
      return { results, agentName, skillNames };
    },
    onSuccess: ({ agentName, skillNames }) => {
      toast(`Agente "${agentName}" executou ${skillNames.length} automações`, 'success');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    saveMut.mutate({ id: taskId, status: newStatus }, {
      onSuccess: () => {
        if (newStatus === 'done' && task?.agent_id && task.skill_ids?.length) {
          const agent = agents.find(a => a.id === task.agent_id);
          const taskSkills = skills.filter(s => task.skill_ids?.includes(s.id));
          const agentName = agent?.name || agent?.title || 'Agente';
          const skillNames = taskSkills.map(s => s.name || s.title || s.slug || 'skill');
          executeSkillsMut.mutate({ task, agentName, skillNames });
        }
      },
    });
  };

  /* filtered tasks */
  const filtered = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (t: Task) => { setEditingTask(t); setNewTask(t); setTaskDialog(true); };
  const openNew = (status?: Task['status']) => { setEditingTask(null); setNewTask({ status: status || 'todo', priority: 'medium', project_id: selectedProject === 'all' ? undefined : selectedProject }); setTaskDialog(true); };

  const taskForm = editingTask ? { ...newTask } : newTask;

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Projetos" 
        subtitle={`${tasks.length} tarefas · ${projects.length} projetos`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button variant="secondary" size="sm" onClick={() => setProjectDialog(true)}>
              <Plus size={14} className="mr-2" /> Projeto
            </Button>
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <Plus size={14} className="mr-2" /> Tarefa
            </Button>
          </div>
        }
      />

      <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <Input 
              placeholder="Buscar tarefas..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          <select 
            value={selectedProject} 
            onChange={e => setSelectedProject(e.target.value)}
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-8) var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center'
            }}
          >
            <option value="all">Todos os projetos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <Button
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('kanban')}
              style={{ borderRadius: 0, border: 'none' }}
            >
              <FolderKanban size={14} />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              style={{ borderRadius: 0, border: 'none' }}
            >
              <List size={14} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <ProjectsSkeleton />
        ) : view === 'kanban' ? (
          /* Kanban View */
          <div style={{ display: 'flex', gap: 'var(--space-6)', overflowX: 'auto', paddingBottom: 'var(--space-4)' }}>
            {COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.key);
              return (
                <div
                  key={col.key}
                  style={{
                    flexShrink: 0,
                    width: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-4)'
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragItem.current) moveTask(dragItem.current, col.key); dragItem.current = null; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>[{colTasks.length}]</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openNew(col.key)}><Plus size={14} /></Button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minHeight: '100px' }}>
                    {colTasks.length === 0 ? (
                      <div style={{ height: '100px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Solte aqui</span>
                      </div>
                    ) : (
                      colTasks.map(task => (
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
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <Card padding="none" border shadow="sm">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.length === 0 ? (
                <EmptyState 
                  icon={<Target size={40} />}
                  title="Nenhuma tarefa"
                  description="Você não tem tarefas que correspondam aos filtros."
                />
              ) : (
                filtered.map((task, idx) => (
                  <div 
                    key={task.id} 
                    onClick={() => openEdit(task)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--space-4)', 
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-base)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: `var(--color-${COLUMNS.find(c => c.key === task.status)?.variant || 'default'})` 
                    }} />
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.title}
                    </span>
                    <Badge variant={PRIORITY_LABELS[task.priority || 'medium'].variant}>
                      {PRIORITY_LABELS[task.priority || 'medium'].label}
                    </Badge>
                    {task.agent_id && <Bot size={14} style={{ color: 'var(--color-accent)' }} />}
                    {task.skill_ids?.length ? <Zap size={14} style={{ color: 'var(--color-warning)' }} /> : null}
                    {task.due_date && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(task.due_date).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Task Dialog - Simplified visual replacement if dialog isn't custom */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <Input label="Título" placeholder="Título da tarefa" value={taskForm.title || ''} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Descrição</label>
              <textarea 
                placeholder="Descrição (opcional)" 
                value={taskForm.description || ''} 
                onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} 
                rows={3} 
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>
            {/* Other fields would follow same pattern - using standard Select from UI if available */}
          </div>
          <DialogFooter>
            {editingTask && (
              <Button variant="ghost" size="sm" onClick={() => { deleteMut.mutate(editingTask.id); setTaskDialog(false); }} style={{ color: 'var(--color-error)' }}>Excluir</Button>
            )}
            <Button variant="primary" onClick={() => saveMut.mutate(taskForm)} disabled={!taskForm.title || saveMut.isPending}>
              {saveMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              {editingTask ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <Input label="Nome" placeholder="Nome do projeto" value={newProject.name || ''} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Descrição</label>
              <textarea placeholder="Descrição (opcional)" value={newProject.description || ''} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} rows={2} style={{ width: '100%', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', resize: 'none', outline: 'none' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="primary" onClick={() => projectMut.mutate(newProject)} disabled={!newProject.name || projectMut.isPending}>
              {projectMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function TaskCard({ task, agents, skills, projects, onEdit, onDelete, onDragStart }: {
  task: Task; agents: any[]; skills: any[]; projects: Project[];
  onEdit: () => void; onDelete: () => void; onDragStart: () => void;
}) {
  const agent = agents.find(a => a.id === task.agent_id);
  const project = projects.find(p => p.id === task.project_id);
  const taskSkills = skills.filter(s => task.skill_ids?.includes(s.id));
  const priority = PRIORITY_LABELS[task.priority || 'medium'];

  return (
    <Card 
      padding="sm" 
      border 
      shadow="sm" 
      className="group"
      style={{ cursor: 'grab', position: 'relative' }}
      onDragStart={onDragStart}
      draggable
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <Badge variant={priority.variant}>{priority.label}</Badge>
            {project && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: '9px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: project.color || 'var(--color-accent)' }} />
                {project.name}
              </span>
            )}
          </div>
          <h4 
            onClick={onEdit}
            style={{ 
              fontSize: 'var(--text-sm)', 
              fontWeight: 'var(--font-medium)', 
              margin: 0, 
              cursor: 'pointer',
              color: 'var(--color-text-primary)' 
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
          >
            {task.title}
          </h4>
          {task.description && (
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', margin: 0 }} className="line-clamp-2">
              {task.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" style={{ padding: 0, width: '24px', height: '24px' }}>
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} style={{ color: 'var(--color-error)' }}>Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
        {agent && <Bot size={12} style={{ color: 'var(--color-accent)' }} title={agent.name} />}
        {taskSkills.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: 'var(--color-warning)' }}>
            <Zap size={10} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{taskSkills.length}</span>
          </div>
        )}
        {task.due_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
            <Calendar size={10} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}


/* ─── sub-components ─── */
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    backlog: 'var(--color-text-tertiary)', 
    todo: 'var(--color-info)', 
    in_progress: 'var(--color-warning)',
    review: 'var(--color-text-primary)', 
    done: 'var(--color-success)',
    cancelled: 'var(--color-error)',
  };
  return <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors[status] || 'var(--color-text-tertiary)' }} />;
}
