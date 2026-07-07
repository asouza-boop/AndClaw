import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Task } from '@/hooks/useProjects';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: Task | null;
  taskForm: Partial<Task>;
  setNewTask: React.Dispatch<React.SetStateAction<Partial<Task>>>;
  deleteMut: any;
  saveMut: any;
}

export function TaskDialog({ open, onOpenChange, editingTask, taskForm, setNewTask, deleteMut, saveMut }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        </div>
        <DialogFooter>
          {editingTask && (
            <Button variant="ghost" size="sm" onClick={() => { deleteMut.mutate(editingTask.id); onOpenChange(false); }} style={{ color: 'var(--color-error)' }}>Excluir</Button>
          )}
          <Button variant="primary" onClick={() => saveMut.mutate(taskForm)} disabled={!taskForm.title || saveMut.isPending}>
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            {editingTask ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
