import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';

export interface Task {
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

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at?: string;
}

export const COLUMNS: { key: Task['status']; label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }[] = [
  { key: 'backlog', label: 'Backlog', variant: 'default' },
  { key: 'todo', label: 'A Fazer', variant: 'info' },
  { key: 'in_progress', label: 'Em Execução', variant: 'warning' },
  { key: 'review', label: 'Revisão', variant: 'default' },
  { key: 'done', label: 'Concluído', variant: 'success' },
  { key: 'cancelled', label: 'Cancelado', variant: 'error' },
];

export const PRIORITY_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  low: { label: 'Baixa', variant: 'default' },
  medium: { label: 'Média', variant: 'info' },
  high: { label: 'Alta', variant: 'warning' },
  urgent: { label: 'Urgente', variant: 'error' },
};

export const PROJECT_COLORS = [
  'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)',
  'var(--color-info)', 'var(--color-error)', 'var(--color-text-secondary)',
];

export function useProjects() {
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

  const saveMut = useMutation({
    mutationFn: (t: Partial<Task>) =>
      t.id
        ? apiFetch(`/api/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify(t) })
        : apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(t) }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['tasks'] }); 
      setTaskDialog(false); 
      setEditingTask(null); 
      setNewTask({ status: 'todo', priority: 'medium' }); 
    },
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
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['projects'] }); 
      setProjectDialog(false); 
      setNewProject({ color: PROJECT_COLORS[0] }); 
    },
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

  const filtered = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (t: Task) => { setEditingTask(t); setNewTask(t); setTaskDialog(true); };
  const openNew = (status?: Task['status']) => { 
    setEditingTask(null); 
    setNewTask({ status: status || 'todo', priority: 'medium', project_id: selectedProject === 'all' ? undefined : selectedProject }); 
    setTaskDialog(true); 
  };

  const taskForm = editingTask ? { ...newTask } : newTask;

  return {
    view,
    setView,
    search,
    setSearch,
    selectedProject,
    setSelectedProject,
    taskDialog,
    setTaskDialog,
    projectDialog,
    setProjectDialog,
    editingTask,
    setEditingTask,
    newTask,
    setNewTask,
    newProject,
    setNewProject,
    dragItem,
    projects,
    tasks,
    agents,
    skills,
    isLoading,
    saveMut,
    deleteMut,
    projectMut,
    moveTask,
    filtered,
    openEdit,
    openNew,
    taskForm,
  };
}
