import { useState } from 'react';
import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateMeetingModalProps {
  onClose: () => void;
  onCreate: (form: { title: string; date: string; duration: string; participants: string }) => void;
}

export function CreateMeetingModal({ onClose, onCreate }: CreateMeetingModalProps) {
  const [form, setForm] = useState({ title: '', date: '', duration: '30', participants: '' });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropBlur: '4px' }}>
      <Card padding="lg" border shadow="md" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Nova Reunião</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Título" placeholder="Ex: Daily Standup" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Data/Hora</label>
              <input 
                type="datetime-local" 
                value={form.date} 
                onChange={(e) => setForm({ ...form, date: e.target.value })} 
                style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', outline: 'none' }} 
              />
            </div>
            <Input label="Duração (min)" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </div>

          <Input label="Participantes" placeholder="Participantes (separados por vírgula)" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-8)' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onCreate(form)} disabled={!form.title.trim()}>Criar Reunião</Button>
        </div>
      </Card>
    </div>
  );
}
