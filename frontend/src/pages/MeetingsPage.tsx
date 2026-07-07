import { Plus, Calendar } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { MeetingsSkeleton } from '@/components/PageSkeletons';

import { useMeetings, Meeting } from '@/hooks/useMeetings';
import { MeetingCard } from '@/components/meetings/MeetingCard';
import { MeetingDetail } from '@/components/meetings/MeetingDetail';
import { CreateMeetingModal } from '@/components/meetings/CreateMeetingModal';

export default function MeetingsPage() {
  const {
    skills,
    loadingMeetings,
    loadingSkills,
    selected,
    setSelected,
    search,
    setSearch,
    createOpen,
    setCreateOpen,
    deleteMeeting,
    createMeeting,
    filtered,
    currentMeeting,
  } = useMeetings();

  if (loadingMeetings || loadingSkills) {
    return <MeetingsSkeleton />;
  }

  return (
    <AppLayout sidebar={<AppSidebar />}>
      {currentMeeting ? (
        <MeetingDetail 
          meeting={currentMeeting} 
          onBack={() => setSelected(null)} 
          skills={skills} 
          deleteMeeting={deleteMeeting as any} 
        />
      ) : (
        <>
          <PageHeader 
            title="Reuniões" 
            subtitle="Gestão de inteligência conversacional"
            actions={
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} className="mr-2" /> Nova Reunião
              </Button>
            }
          />

          <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ flex: 1, maxWidth: '400px' }}>
                <Input placeholder="Buscar reuniões..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {filtered.length} reuniões
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
              {filtered.map((m: Meeting, i: number) => (
                <MeetingCard key={m._id || m.id || i} meeting={m} onClick={() => setSelected(m)} />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <EmptyState 
                    icon={<Calendar size={40} />}
                    title={search ? "Nenhuma reunião encontrada" : "Agenda Vazia"}
                    description={search ? "Tente buscar por outro termo." : "Crie sua primeira reunião para começar a extrair inteligência."}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {createOpen && (
        <CreateMeetingModal
          onClose={() => setCreateOpen(false)}
          onCreate={createMeeting}
        />
      )}
    </AppLayout>
  );
}
