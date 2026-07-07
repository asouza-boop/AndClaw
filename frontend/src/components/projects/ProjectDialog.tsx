import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Project } from '@/hooks/useProjects';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newProject: Partial<Project>;
  setNewProject: React.Dispatch<React.SetStateAction<Partial<Project>>>;
  projectMut: any;
}

export function ProjectDialog({ open, onOpenChange, newProject, setNewProject, projectMut }: ProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <Input label="Nome" placeholder="Nome do projeto" value={newProject.name || ''} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Descrição</label>
            <textarea 
              placeholder="Descrição (opcional)" 
              value={newProject.description || ''} 
              onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} 
              rows={2} 
              style={{ width: '100%', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', resize: 'none', outline: 'none' }} 
            />
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
  );
}
