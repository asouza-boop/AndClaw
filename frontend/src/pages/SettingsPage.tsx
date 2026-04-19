import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Server, Database, Brain, Clock, ExternalLink, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const integrations = [
  { key: 'google_calendar', label: 'Google Calendar', icon: '📅', desc: 'Sincronize sua agenda' },
  { key: 'gitvault', label: 'GitVault', icon: '🔒', desc: 'Backup para GitHub' },
  { key: 'raindrop', label: 'Raindrop', icon: '🔖', desc: 'Sincronizar favoritos' },
  { key: 'push', label: 'Push Notifications', icon: '🔔', desc: 'Notificações VAPID' },
  { key: 'telegram', label: 'Telegram Bot', icon: '🤖', desc: 'Bot token' },
  { key: 'ai', label: 'Inteligência Artificial', icon: '🧠', desc: 'LLM chain config' },
  { key: 'deploy', label: 'Deploy', icon: '🚀', desc: 'Render deploy hook' },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => apiFetch<any>('/api/status').catch(() => null) });
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: () => apiFetch<any>('/api/settings').catch(() => null) });
  const { data: metricsData, isFetching: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiFetch<any>('/admin/metrics').catch(() => null),
    refetchInterval: 30000,
  });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState('');
  const [saving, setSaving] = useState(false);

  const settingKeyMap: Record<string, string> = {
    google_calendar: 'GOOGLE_EXPORT_CALENDAR_ID',
    gitvault: 'GITVAULT_REPO',
    raindrop: 'RAINDROP_TOKEN',
    push: 'VAPID_PUBLIC_KEY',
    ai: 'GEMINI_API_KEY',
    deploy: 'RENDER_DEPLOY_HOOK_URL',
  };

  const saveConfig = async () => {
    if (!activeModal || !configValue.trim()) return;
    setSaving(true);
    try {
      const settingKey = settingKeyMap[activeModal];
      if (!settingKey) throw new Error('Integração ainda não suportada neste painel.');
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [settingKey]: configValue.trim() }),
      });
      toast('Configuração salva', 'success');
      setActiveModal(null);
      setConfigValue('');
      qc.invalidateQueries({ queryKey: ['status'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const metrics = metricsData?.metrics || {};
  const history = Array.isArray(metricsData?.history) ? metricsData.history : [];
  const metricValue = (key: string) => {
    const entry = metrics[key];
    if (!entry) return null;
    if (typeof entry.value === 'number') return entry.value;
    if (typeof entry.count === 'number') return entry.count;
    return null;
  };
  const metricAvg = (key: string) => {
    const entry = metrics[key];
    return typeof entry?.average === 'number' ? entry.average : null;
  };
  const metricCount = (key: string) => {
    const entry = metrics[key];
    return typeof entry?.count === 'number' ? entry.count : null;
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Health */}
      <div className="rounded-xl bg-surface glow-border p-5">
        <h3 className="text-sm font-semibold mb-4">Status do Sistema</h3>
        <div className="flex gap-6">
          {[
            { label: 'Backend', icon: Server, ok: !!status?.ok },
            { label: 'Database', icon: Database, ok: !!status?.db?.ok },
            { label: 'LLM', icon: Brain, ok: !!status?.llmConfigured },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{s.label}</span>
              <span className={`w-2 h-2 rounded-full ${s.ok ? 'bg-success' : 'bg-destructive'}`} />
            </div>
          ))}
          {status?.lastDeploy && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">Último deploy: {new Date(status.lastDeploy).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Integrations grid */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Integrações</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {integrations.map((int) => (
            <button
              key={int.key}
              onClick={() => {
                if (int.key === 'ai') {
                  navigate('/settings/providers');
                } else {
                  setActiveModal(int.key);
                  setConfigValue('');
                }
              }}
              className="flex items-center gap-4 p-4 rounded-xl bg-surface glow-border text-left transition-colors hover:bg-surface-2 group"
            >
              <span className="text-2xl">{int.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{int.label}</p>
                <p className="text-xs text-muted-foreground">
                  {int.desc}
                  {settingKeyMap[int.key] && settingsData?.settings?.[settingKeyMap[int.key]] === 'configured' ? ' · configurado' : ''}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-xl bg-surface glow-border p-5">
        <h3 className="text-sm font-semibold mb-3">Log de Atividade</h3>
        <div className="space-y-2">
          {(status?.recentEvents || []).slice(0, 8).map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-xs text-muted-foreground w-16">{new Date(e.timestamp || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">{e.type || 'info'}</span>
              <span className="text-muted-foreground">{e.message || e.description || 'Evento'}</span>
            </div>
          ))}
          {(!status?.recentEvents || status.recentEvents.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhum evento recente</p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="rounded-xl bg-surface glow-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Métricas</h3>
            <p className="text-xs text-muted-foreground">Visão leve de cache, agente, memória e ferramentas.</p>
          </div>
          <button
            onClick={() => refetchMetrics()}
            className="px-3 py-2 rounded-md text-xs border border-white/[0.08] text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
            disabled={metricsLoading}
          >
            {metricsLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Cache Hit', key: 'cache.hit', kind: 'count' as const },
            { label: 'Cache Miss', key: 'cache.miss', kind: 'count' as const },
            { label: 'Agent Latency', key: 'agent.latency', kind: 'avg' as const, suffix: 'ms' },
            { label: 'Memory Search', key: 'memory.search.count', kind: 'count' as const },
            { label: 'Tool Exec', key: 'tool.execution.count', kind: 'count' as const },
            { label: 'Tool Errors', key: 'tool.execution.error', kind: 'count' as const },
            { label: 'Memory Latency', key: 'memory.search.latency', kind: 'avg' as const, suffix: 'ms' },
            { label: 'Cache Save', key: 'cache.save', kind: 'count' as const },
          ].map((item) => {
            const value = item.kind === 'avg' ? metricAvg(item.key) : metricValue(item.key);
            const count = metricCount(item.key);
            return (
              <div key={item.key} className="rounded-lg bg-surface-2 border border-white/[0.06] p-4">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-xl font-semibold">
                  {value ?? '—'}
                  {item.suffix ? <span className="text-sm text-muted-foreground ml-1">{item.suffix}</span> : null}
                </div>
                {item.kind === 'avg' && count !== null && (
                  <div className="mt-1 text-[11px] text-muted-foreground">n={count}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Histórico recente</p>
              <p className="text-xs text-muted-foreground">Últimos snapshots em memória para depuração rápida.</p>
            </div>
            <span className="text-[11px] text-muted-foreground">{history.length} snapshots</span>
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map((entry: any) => {
              const cacheHits = entry.metrics?.['cache.hit']?.value ?? 0;
              const agentLatency = entry.metrics?.['agent.latency']?.average ?? 0;
              const memorySearch = entry.metrics?.['memory.search.count']?.value ?? 0;
              return (
                <div key={`${entry.capturedAt}-${entry.mutationCount}`} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg bg-surface-2 border border-white/[0.06] px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.capturedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    <span className="mx-2 text-white/30">•</span>
                    mutação #{entry.mutationCount}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">cache.hit {cacheHits}</span>
                    <span className="px-2 py-1 rounded-full bg-accent/10 text-accent">agent.latency {Math.round(agentLatency)}ms</span>
                    <span className="px-2 py-1 rounded-full bg-white/[0.04] text-muted-foreground">memory.search {memorySearch}</span>
                  </div>
                </div>
              );
            })}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">Histórico ainda vazio.</p>
            )}
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-surface glow-border p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{integrations.find((i) => i.key === activeModal)?.label}</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configure a integração inserindo as credenciais necessárias.
            </p>
            <input
              type="password"
              value={configValue}
              onChange={(e) => setConfigValue(e.target.value)}
              placeholder="API key / Token / URL..."
              className="w-full px-4 py-3 rounded-md bg-surface-2 border border-white/[0.07] text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setActiveModal(null)} className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                disabled={saving || !configValue.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar e ativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
