import { MoreHorizontal, Bot, Zap, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Task, Project, PRIORITY_LABELS } from '@/hooks/useProjects';

export function TaskCard({ task, agents, skills, projects, onEdit, onDelete, onDragStart }: {
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
