import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Inbox,
  Layers3,
  Search,
  Shield,
  Sparkles,
  Settings2,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAgentStore } from '@/stores/agentStore';
import { cn } from '@/lib/utils';
import { ExecutionTimeline } from './agent/ExecutionTimeline';

type IntelligenceTab = 'why' | 'memory' | 'trace' | 'security';

interface IntelligenceSidebarProps {
  title?: string;
}

const routePlaybooks: Record<
  string,
  {
    summary: string;
    next: string[];
    mode: string;
  }
> = {
  '/dashboard': {
    summary: 'Painel executivo com visão geral de sinais, prioridades e pendências.',
    next: ['Revisar inbox', 'Abrir agenda', 'Capturar contexto novo'],
    mode: 'Command Center',
  },
  '/inbox': {
    summary: 'Fila operacional para triagem, conversão e limpeza de itens.',
    next: ['Classificar entradas', 'Converter em tarefa', 'Arquivar duplicados'],
    mode: 'Triage',
  },
  '/chat': {
    summary: 'Conversa direta com o agente para decisões rápidas e captura de contexto.',
    next: ['Perguntar status', 'Gerar ação', 'Registrar insight'],
    mode: 'Conversation',
  },
  '/agenda': {
    summary: 'Agenda central com alertas, compromissos e blocos de foco.',
    next: ['Importar horários', 'Bloquear tempo', 'Checar conflitos'],
    mode: 'Planning',
  },
  '/projetos': {
    summary: 'Acompanhamento de iniciativas, entregas e próximos movimentos.',
    next: ['Abrir projeto ativo', 'Revisar tarefas', 'Atualizar status'],
    mode: 'Delivery',
  },
  '/reunioes': {
    summary: 'Inteligência de reuniões para pautas, transcrições e próximos passos.',
    next: ['Analisar reunião', 'Gerar conhecimento', 'Abrir follow-up'],
    mode: 'Meetings',
  },
  '/conhecimento': {
    summary: 'Base de memória para decisões, insights e sínteses recorrentes.',
    next: ['Buscar insight', 'Criar vínculo', 'Revisar memória'],
    mode: 'Knowledge',
  },
  '/settings': {
    summary: 'Zona de controle para integrações, aparência e perfil operacional.',
    next: ['Checar integrações', 'Validar tema', 'Revisar notificações'],
    mode: 'Control',
  },
};

const shortcuts = [
  { label: 'Inbox', to: '/inbox', icon: Inbox },
  { label: 'Conhecimento', to: '/conhecimento', icon: BookOpen },
  { label: 'Configurações', to: '/settings', icon: Settings2 },
];

export function IntelligenceSidebar({ title }: IntelligenceSidebarProps) {
  const location = useLocation();
  const uiMode = useAgentStore((s) => s.uiMode);
  const currentRequestId = useAgentStore((s) => s.currentRequestId);
  const currentTrace = useAgentStore((s) => s.currentTrace);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const items = useNotificationStore((s) => s.items);
  const [expanded, setExpanded] = useState(uiMode === 'debug');
  const [activeTab, setActiveTab] = useState<IntelligenceTab>(uiMode === 'debug' ? 'trace' : 'why');

  useEffect(() => {
    if (uiMode === 'debug') {
      setExpanded(true);
      setActiveTab((current) => (current === 'security' || current === 'memory' ? current : 'trace'));
    }
  }, [uiMode]);

  const playbook = routePlaybooks[location.pathname] ?? {
    summary: 'Painel contextual para leitura rápida do que importa agora.',
    next: ['Abrir inbox', 'Capturar nota', 'Revisar sinais'],
    mode: 'Adaptive',
  };

  const recentSignals = useMemo(() => items.slice(0, 3), [items]);

  const traceSteps = currentTrace?.steps ?? [];
  const reasoningSteps = useMemo(
    () =>
      traceSteps.filter((step) =>
        [
          'agent.intent.detected',
          'agent.plan.created',
          'agent.plan.result',
          'agent.plan.fallback',
          'agent.skill.selected',
          'agent.skill.executed',
          'agent.skill.fallback',
        ].includes(step.type),
      ),
    [traceSteps],
  );
  const memorySteps = useMemo(
    () => traceSteps.filter((step) => step.type.includes('memory') || step.type.includes('cache')),
    [traceSteps],
  );
  const securitySteps = useMemo(
    () =>
      traceSteps.filter(
        (step) =>
          step.type.includes('security') ||
          step.type.includes('spec') ||
          step.status === 'blocked' ||
          step.type.includes('policy'),
      ),
    [traceSteps],
  );

  const signalStats = useMemo(
    () => [
      { label: 'Unread', value: String(unreadCount).padStart(2, '0'), icon: Bell },
      { label: 'Signals', value: String(Math.max(items.length, 1)).padStart(2, '0'), icon: Activity },
      { label: 'Mode', value: playbook.mode, icon: BrainCircuit },
    ],
    [items.length, playbook.mode, unreadCount],
  );

  return (
    <aside
      className={cn(
        'hidden 2xl:block shrink-0 pr-4 transition-[width] duration-300 ease-out',
        expanded ? 'w-[22rem]' : 'w-[4.75rem]',
      )}
    >
      <div className="sticky top-4 flex h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-white/[0.08] bg-surface/35 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        {!expanded ? (
          <div className="flex h-full w-full flex-col items-center justify-between px-2 py-4">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-all duration-200 hover:scale-[1.02] hover:bg-primary/15"
              aria-label="Abrir painel de inteligência"
            >
              <Sparkles className="h-4.5 w-4.5" />
            </button>

            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1">
                <span className="block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.4)]" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground [writing-mode:vertical-rl] [transform:rotate(180deg)]">
                Intelligence
              </span>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Expandir painel"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col">
            <div className="border-b border-white/[0.06] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Intelligence
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Command signals</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{title || 'Workspace context'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{uiMode === 'debug' ? 'Debug' : 'Normal'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                    aria-label="Fechar painel"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
                {[
                  { id: 'why' as const, label: 'Why', icon: BrainCircuit },
                  { id: 'memory' as const, label: 'Memory', icon: Database },
                  { id: 'trace' as const, label: 'Trace', icon: Activity },
                  { id: 'security' as const, label: 'Security', icon: Shield },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'group flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200',
                        active
                          ? 'border border-primary/20 bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(168,85,247,0.08)]'
                          : 'border border-transparent text-muted-foreground hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-foreground',
                      )}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-full overflow-y-auto px-5 py-5">
              {activeTab === 'why' && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Focus now</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">{playbook.mode}</h3>
                      </div>
                      <div className="rounded-xl border border-primary/15 bg-primary/10 px-3 py-2 text-primary">
                        <Layers3 className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{playbook.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {playbook.next.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/[0.07] bg-surface/60 px-3 py-1 text-[11px] font-medium text-foreground/90"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Runtime</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Request trace</h3>
                      </div>
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/[0.07] bg-surface/45 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Request ID</p>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">{currentRequestId || 'idle'}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.07] bg-surface/45 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Signals</p>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">{String(Math.max(items.length, 1)).padStart(2, '0')}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Navigation</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Quick jump</h3>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-2">
                      {shortcuts.map((shortcut) => (
                        <Link
                          key={shortcut.to}
                          to={shortcut.to}
                          className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-surface/40 px-3 py-3 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-primary/8 hover:text-foreground"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-muted-foreground transition-all duration-200 group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
                            <shortcut.icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1 font-medium">{shortcut.label}</span>
                          <ArrowUpRight className="h-4 w-4 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'memory' && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Semantic map</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Recent memory</h3>
                      </div>
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {memorySteps.length > 0 ? (
                        memorySteps.map((step, index) => (
                          <div key={`${step.type}-${index}`} className="rounded-xl border border-white/[0.06] bg-surface/45 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {step.type.split('.').pop()}
                              </p>
                              <span className="text-[10px] text-muted-foreground">{step.status}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {step.data ? JSON.stringify(step.data).slice(0, 180) : 'Vector memory event recorded.'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/[0.08] bg-surface/35 px-3 py-4 text-sm text-muted-foreground">
                          No semantic memory signals available.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent signals</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Notifications</h3>
                      </div>
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {recentSignals.length > 0 ? (
                        recentSignals.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-surface/45 px-3 py-3"
                          >
                            <div
                              className={cn(
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                                item.read
                                  ? 'border-white/[0.08] bg-white/[0.03] text-muted-foreground'
                                  : 'border-primary/20 bg-primary/10 text-primary',
                              )}
                            >
                              <BrainCircuit className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground line-clamp-1">{item.title || 'Notification'}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">
                                {item.body || 'No further details available.'}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/[0.08] bg-surface/35 px-3 py-4 text-sm text-muted-foreground">
                          No recent signals. The workspace is quiet.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'trace' && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Trace</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Execution path</h3>
                      </div>
                      <Layers3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-4">
                      <ExecutionTimeline
                        steps={traceSteps}
                        title="Agent Trace"
                        emptyMessage="No trace available for the current session."
                      />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Reasoning</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Planner steps</h3>
                      </div>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-2">
                      {reasoningSteps.length > 0 ? (
                        reasoningSteps.map((step, index) => (
                          <div key={`${step.type}-${index}`} className="rounded-xl border border-white/[0.06] bg-surface/45 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                                {step.type.split('.').pop()}
                              </p>
                              <span className="text-[10px] text-muted-foreground">{step.status}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {step.data ? JSON.stringify(step.data).slice(0, 180) : 'No step payload available.'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/[0.08] bg-surface/35 px-3 py-4 text-sm text-muted-foreground">
                          No reasoning trace available yet.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Governance</p>
                        <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Active constitution</h3>
                      </div>
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Prompt injection monitoring and policy enforcement are active for this workspace.
                    </p>
                  </section>

                  <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Policy status</p>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                        {securitySteps.length === 0 ? 'Clear' : 'Review'}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {securitySteps.length > 0 ? (
                        securitySteps.map((step, index) => (
                          <div key={`${step.type}-${index}`} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">
                              {step.type.split('.').pop()}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-foreground/90">
                              {step.data?.reason || 'Access denied by governance policy.'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-emerald-500/15 bg-white/[0.02] px-3 py-4 text-sm text-emerald-300/70">
                          No policy violations detected.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
