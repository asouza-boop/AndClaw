import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Clock, MapPin, Video,
  CalendarDays, List, Loader2, X, RefreshCw
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

/* ── helpers ─────────────────────────────────────────── */

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/* ── types ───────────────────────────────────────────── */

interface CalendarEvent {
  id: string;
  title?: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  meetLink?: string;
  meet_link?: string;
  hangoutLink?: string;
  source?: string;
  status?: string;
  allDay?: boolean;
  color?: string;
}

/* ── sub-components ──────────────────────────────────── */

function EventCard({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const title = event.title || event.summary || 'Sem título';
  const start = event.start || event.startDate;
  const end = event.end || event.endDate;
  const link = event.meetLink || event.meet_link || event.hangoutLink;
  const isGoogle = event.source === 'google' || event.source === 'gcal';

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '2px var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--color-accent-subtle)',
        color: 'var(--color-accent)',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {start && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', opacity: 0.8 }}>{formatTime(start)}</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </div>
    );
  }

  return (
    <Card padding="sm" border shadow="sm">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{title}</h4>
        <Badge variant={isGoogle ? 'info' : 'default'}>
          {isGoogle ? 'Google' : 'Local'}
        </Badge>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
        {start && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}>
            <Clock size={12} />
            {formatTime(start)}
            {end && ` – ${formatTime(end)}`}
          </span>
        )}
        {event.location && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <MapPin size={12} />
            {event.location}
          </span>
        )}
        {link && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.open(link, '_blank')}
            style={{ height: 'auto', padding: 0, fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}
          >
            <Video size={12} style={{ marginRight: 'var(--space-1)' }} />
            Entrar
          </Button>
        )}
      </div>

      {event.description && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', margin: 0 }} className="line-clamp-2">
          {event.description}
        </p>
      )}
    </Card>
  );
}

function NewEventModal({ date, onClose }: { date: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      const dateStr = date.toISOString().split('T')[0];
      return apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          start: `${dateStr}T${startTime}:00`,
          end: `${dateStr}T${endTime}:00`,
          description,
          location,
        }),
      });
    },
    onSuccess: () => {
      toast('Evento criado com sucesso', 'success');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropBlur: '4px' }}>
      <Card padding="lg" border shadow="md" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Novo evento</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>{formatDateFull(date)}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do evento"
          />

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Início"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Fim"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <Input
            label="Local"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Local (opcional)"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              style={{
                width: '100%',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                resize: 'none',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => create.mutate()}
              disabled={!title.trim() || create.isPending}
            >
              {create.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
              Criar evento
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── main page ───────────────────────────────────────── */

export default function AgendaPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [view, setView] = useState<'month' | 'list'>('month');
  const [newEventModal, setNewEventModal] = useState(false);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray),
  });

  // Sync Google Calendar
  const syncGoogle = useMutation({
    mutationFn: () => apiFetch('/api/calendar/sync', { method: 'POST' }),
    onSuccess: () => {
      toast('Google Calendar sincronizado', 'success');
      refetch();
    },
    onError: (e: Error) => toast(e.message || 'Erro ao sincronizar', 'error'),
  });

  /* ── calendar grid logic ─────────────────────────────── */

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [daysInMonth, firstDay]);

  const eventsForDay = (day: number) => {
    const target = new Date(currentYear, currentMonth, day);
    return events.filter((e: CalendarEvent) => {
      const start = e.start || e.startDate;
      return start && isSameDay(new Date(start), target);
    });
  };

  const selectedDayEvents = useMemo(() => {
    return events
      .filter((e: CalendarEvent) => {
        const start = e.start || e.startDate;
        return start && isSameDay(new Date(start), selectedDate);
      })
      .sort((a: CalendarEvent, b: CalendarEvent) => {
        const sa = a.start || a.startDate || '';
        const sb = b.start || b.startDate || '';
        return sa.localeCompare(sb);
      });
  }, [events, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e: CalendarEvent) => {
        const start = e.start || e.startDate;
        return start && new Date(start) >= now;
      })
      .sort((a: CalendarEvent, b: CalendarEvent) => {
        const sa = a.start || a.startDate || '';
        const sb = b.start || b.startDate || '';
        return sa.localeCompare(sb);
      })
      .slice(0, 10);
  }, [events]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };
  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(today);
  };

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Agenda" 
        subtitle={`${events.length} evento${events.length !== 1 ? 's' : ''} carregado${events.length !== 1 ? 's' : ''}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => syncGoogle.mutate()}
              disabled={syncGoogle.isPending}
            >
              <RefreshCw size={14} className={`mr-2 ${syncGoogle.isPending ? 'animate-spin' : ''}`} />
              Sincronizar Google
            </Button>

            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <Button
                variant={view === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
                style={{ borderRadius: 0, border: 'none' }}
              >
                <CalendarDays size={14} />
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

            <Button
              variant="primary"
              size="sm"
              onClick={() => setNewEventModal(true)}
            >
              <Plus size={14} className="mr-2" />
              Novo evento
            </Button>
          </div>
        }
      />

      <div style={{ marginTop: 'var(--space-8)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', padding: 'var(--space-20)' }}>
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : view === 'month' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-8)' }} className="lg:grid-cols-[1fr_340px]">
            {/* Calendar Grid */}
            <Card padding="md" border shadow="sm">
              <div style={{ display: 'flex', alignItems: 'center', justifyHeight: 'space-between', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft size={16} /></Button>
                  <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', minWidth: '160px', textAlign: 'center', margin: 0 }}>
                    {MONTHS[currentMonth]} {currentYear}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight size={16} /></Button>
                </div>
                <Button variant="secondary" size="sm" onClick={goToToday}>Hoje</Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-1)' }}>
                {WEEKDAYS.map((wd) => (
                  <div key={wd} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'var(--font-medium)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', padding: 'var(--space-2) 0' }}>
                    {wd}
                  </div>
                ))}
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} style={{ minHeight: '100px' }} />;
                  const date = new Date(currentYear, currentMonth, day);
                  const isToday = isSameDay(date, today);
                  const isSelected = isSameDay(date, selectedDate);
                  const dayEvents = eventsForDay(day);

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDate(date)}
                      style={{
                        minHeight: '100px',
                        padding: 'var(--space-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'transparent',
                        borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)'
                      }}
                      onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                      onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        fontSize: '12px',
                        fontWeight: 'var(--font-medium)',
                        backgroundColor: isToday ? 'var(--color-accent)' : 'transparent',
                        color: isToday ? 'var(--color-text-inverse)' : isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)'
                      }}>
                        {day}
                      </span>
                      <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {dayEvents.slice(0, 2).map((ev: CalendarEvent) => (
                          <EventCard key={ev.id} event={ev} compact />
                        ))}
                        {dayEvents.length > 2 && (
                          <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', padding: '0 4px' }}>
                            +{dayEvents.length - 2} mais
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Side Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <Card padding="md" border shadow="sm">
                <div style={{ display: 'flex', alignItems: 'center', justifyHeight: 'space-between', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                      {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
                    </h3>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'capitalize', margin: 0 }}>
                      {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setNewEventModal(true)}><Plus size={16} /></Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {selectedDayEvents.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-8) 0' }}>
                      Nenhum evento neste dia
                    </p>
                  ) : (
                    selectedDayEvents.map((ev: CalendarEvent) => (
                      <EventCard key={ev.id} event={ev} />
                    ))
                  )}
                </div>
              </Card>

              <Card padding="md" border shadow="sm">
                <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
                  Próximos eventos
                </h3>
                {upcomingEvents.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Nenhum evento futuro</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {upcomingEvents.map((ev: CalendarEvent) => {
                      const start = ev.start || ev.startDate || '';
                      const d = new Date(start);
                      return (
                        <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                          <div style={{ width: '40px', textAlign: 'center', flexShrink: 0 }}>
                            <p style={{ fontWeight: 'var(--font-semibold)', margin: 0 }}>{d.getDate()}</p>
                            <p style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                              {MONTHS[d.getMonth()]?.slice(0, 3)}
                            </p>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.title || ev.summary}
                            </p>
                            <p style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', margin: 0 }}>{formatTime(start)}</p>
                          </div>
                          <Badge variant={ev.source === 'google' || ev.source === 'gcal' ? 'info' : 'default'}>
                            {ev.source === 'google' || ev.source === 'gcal' ? 'G' : 'L'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          /* List View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '800px' }}>
            {upcomingEvents.length === 0 ? (
              <Card padding="lg" border shadow="sm" style={{ textAlign: 'center' }}>
                <CalendarDays size={40} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }} />
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Nenhum evento futuro encontrado</p>
                <Button variant="secondary" onClick={() => syncGoogle.mutate()} style={{ marginTop: 'var(--space-4)' }}>
                  Sincronizar Google Calendar
                </Button>
              </Card>
            ) : (
              upcomingEvents.map((ev: CalendarEvent) => <EventCard key={ev.id} event={ev} />)
            )}
          </div>
        )}
      </div>

      {newEventModal && <NewEventModal date={selectedDate} onClose={() => setNewEventModal(false)} />}
    </AppLayout>
  );
}

