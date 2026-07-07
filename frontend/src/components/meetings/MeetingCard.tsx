import { Calendar, Clock, Users, CheckSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Meeting } from '@/hooks/useMeetings';

export const statusVariants: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  scheduled: { label: 'Agendada', variant: 'info' },
  in_progress: { label: 'Em andamento', variant: 'warning' },
  completed: { label: 'Concluída', variant: 'success' },
};

export function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const status = meeting.status || 'scheduled';
  const cfg = statusVariants[status] || statusVariants.scheduled;
  const date = meeting.date ? new Date(meeting.date) : null;

  return (
    <Card padding="sm" border shadow="sm" onClick={onClick} className="group cursor-pointer">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }} className="group-hover:text-primary transition-colors">
          {meeting.title}
        </h4>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: '10px', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-mono)' }}>
        {date && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Calendar size={10} />
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {meeting.duration && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Clock size={10} />
            {meeting.duration}m
          </span>
        )}
        {meeting.participants && meeting.participants.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Users size={10} />
            {meeting.participants.length}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', opacity: 0.7, marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        {meeting.key_points && meeting.key_points.length > 0 && <span>🎯 {meeting.key_points.length}</span>}
        {meeting.alerts && meeting.alerts.filter((a: any) => a.severity === 'high').length > 0 && (
          <span>🔴 {meeting.alerts.filter((a: any) => a.severity === 'high').length}</span>
        )}
        {meeting.tasks_future && meeting.tasks_future.length > 0 && <span>📅 {meeting.tasks_future.length}</span>}
        {meeting.memory_highlights && meeting.memory_highlights.length > 0 && <span>🧠 {meeting.memory_highlights.length}</span>}
      </div>

      {meeting.action_items && meeting.action_items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
          <CheckSquare size={10} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {meeting.action_items.filter(a => a.done).length}/{meeting.action_items.length} ações
          </span>
        </div>
      )}

      {meeting.skills_used && meeting.skills_used.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
          {meeting.skills_used.slice(0, 3).map((s, i) => (
            <Badge key={i} variant="primary" style={{ fontSize: '9px', padding: '1px 6px' }}>{s}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
