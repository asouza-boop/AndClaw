import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/card';
import { ProjectsSkeleton } from '@/components/PageSkeletons';
import {
  Plus, FolderKanban, List, Target, Bot, Zap, Calendar
} from 'lucide-react';

import { useProjects, COLUMNS, PRIORITY_LABELS, Task } from '@/hooks/useProjects';
import { TaskCard } from '@/components/projects/TaskCard';
import { TaskDialog } from '@/components/projects/TaskDialog';
import { ProjectDialog } from '@/components/projects/ProjectDialog';

export default function ProjectsPage() {
  const {
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
    setNewTask,
    newProject,
    setNewProject,
    dragItem,
    projects,
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
  } = useProjects();

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Projetos" 
        subtitle={`${filtered.length} tarefas · ${projects.length} projetos`}
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
                filtered.map((task: Task, idx: number) => (
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

      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        editingTask={editingTask}
        taskForm={taskForm}
        setNewTask={setNewTask}
        deleteMut={deleteMut}
        saveMut={saveMut}
      />

      <ProjectDialog
        open={projectDialog}
        onOpenChange={setProjectDialog}
        newProject={newProject}
        setNewProject={setNewProject}
        projectMut={projectMut}
      />
    </AppLayout>
  );
}
