import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Clock, MapPin, Video,
  CalendarDays, List, Loader2, X, ExternalLink, RefreshCw
} from 'lucide-react';

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

function EventBadge({ event }: { event: CalendarEvent }) {
  const isGoogle = event.source === 'google' || event.source === 'gcal';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
        isGoogle
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          : 'bg-primary/10 text-primary border-primary/20'
      }`}
    >
      {isGoogle ? 'Google' : 'Local'}
    </span>
  );
}

function EventCard({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const title = event.title || event.summary || 'Sem título';
  const start = event.start || event.startDate;
  const end = event.end || event.endDate;
  const link = event.meetLink || event.meet_link || event.hangoutLink;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] truncate cursor-default hover:bg-primary/20 transition-colors">
        {start && <span className="shrink-0 font-mono text-[10px]">{formatTime(start)}</span>}
        <span className="truncate">{title}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface glow-border p-4 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-tight">{title}</h4>
        <EventBadge event={event} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {start && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(start)}
            {end && ` – ${formatTime(end)}`}
          </span>
        )}
        {event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.location}
          </span>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-accent hover:underline"
          >
            <Video className="w-3 h-3" />
            Entrar
          </a>
        )}
      </div>

      {event.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
      )}
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface-2 border border-white/[0.07] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Novo evento</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-3 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{formatDateFull(date)}</p>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do evento"
          className="w-full bg-surface rounded-xl border border-white/[0.07] px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Início</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-surface rounded-xl border border-white/[0.07] px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Fim</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-surface rounded-xl border border-white/[0.07] px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>
        </div>

        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Local (opcional)"
          className="w-full bg-surface rounded-xl border border-white/[0.07] px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (opcional)"
          rows={2}
          className="w-full bg-surface rounded-xl border border-white/[0.07] px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground resize-none"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-surface-3 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!title.trim() || create.isPending}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Criar evento
          </button>
        </div>
      </div>
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

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {events.length} evento{events.length !== 1 && 's'} carregado{events.length !== 1 && 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncGoogle.mutate()}
            disabled={syncGoogle.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncGoogle.isPending ? 'animate-spin' : ''}`} />
            Sincronizar Google
          </button>

          <div className="flex rounded-xl border border-white/[0.07] overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-2 text-xs transition-colors ${view === 'month' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-3'}`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-xs transition-colors ${view === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-3'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setNewEventModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo evento
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : view === 'month' ? (
        /* ── Month View ─────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Calendar */}
          <div className="rounded-xl bg-surface glow-border p-5">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface-3 text-muted-foreground transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-semibold min-w-[180px] text-center">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface-3 text-muted-foreground transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button onClick={goToToday} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-surface-3 border border-white/[0.07] transition-colors">
                Hoje
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-2">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="min-h-[80px]" />;
                const date = new Date(currentYear, currentMonth, day);
                const isToday = isSameDay(date, today);
                const isSelected = isSameDay(date, selectedDate);
                const dayEvents = eventsForDay(day);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-[80px] p-1.5 border border-white/[0.04] text-left transition-colors rounded-md ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30'
                        : 'hover:bg-surface-3'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        isToday
                          ? 'bg-primary text-white'
                          : isSelected
                            ? 'text-primary'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map((ev: CalendarEvent) => (
                        <EventCard key={ev.id} event={ev} compact />
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[10px] text-muted-foreground px-2">
                          +{dayEvents.length - 2} mais
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day detail sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl bg-surface glow-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">{selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}</h3>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
                </div>
                <button
                  onClick={() => setNewEventModal(true)}
                  className="p-2 rounded-lg hover:bg-surface-3 text-muted-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento neste dia</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map((ev: CalendarEvent) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming */}
            <div className="rounded-xl bg-surface glow-border p-5">
              <h3 className="text-sm font-semibold mb-3">Próximos eventos</h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento futuro</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((ev: CalendarEvent) => {
                    const start = ev.start || ev.startDate || '';
                    const d = new Date(start);
                    return (
                      <div key={ev.id} className="flex items-center gap-3 text-xs">
                        <div className="shrink-0 w-10 text-center">
                          <p className="font-semibold text-foreground">{d.getDate()}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{MONTHS[d.getMonth()]?.slice(0, 3)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-foreground">{ev.title || ev.summary}</p>
                          <p className="text-muted-foreground">{formatTime(start)}</p>
                        </div>
                        <EventBadge event={ev} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── List View ──────────────────────────────────── */
        <div className="space-y-3 max-w-2xl">
          {upcomingEvents.length === 0 ? (
            <div className="rounded-xl bg-surface glow-border p-8 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum evento futuro encontrado</p>
              <button
                onClick={() => syncGoogle.mutate()}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Sincronizar Google Calendar
              </button>
            </div>
          ) : (
            upcomingEvents.map((ev: CalendarEvent) => <EventCard key={ev.id} event={ev} />)
          )}
        </div>
      )}

      {/* New event modal */}
      {newEventModal && <NewEventModal date={selectedDate} onClose={() => setNewEventModal(false)} />}
    </div>
  );
}
