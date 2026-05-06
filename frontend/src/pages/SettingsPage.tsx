import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Server, Database, Brain, Clock, ExternalLink, X, Loader2, Activity, Shield, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

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
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Configurações" 
        subtitle="Gerencie sua conta e as integrações do sistema"
      />

      <div className="mt-8 flex flex-col gap-8">
        {/* System Health */}
        <Card shadow="sm" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase text-text-tertiary m-0">Status do Sistema</h3>
          </div>
          <div className="flex flex-wrap gap-6">
            {[
              { label: 'Backend', icon: Server, ok: !!status?.ok },
              { label: 'Database', icon: Database, ok: !!status?.db?.ok },
              { label: 'LLM', icon: Brain, ok: !!status?.llmConfigured },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <s.icon size={14} className="text-text-tertiary" />
                <span className="text-sm">{s.label}</span>
                <Badge variant={s.ok ? 'success' : 'danger'} className="p-1 rounded-full min-w-[8px] min-h-[8px] h-2 w-2" />
              </div>
            ))}
            {status?.lastDeploy && (
              <div className="flex items-center gap-2 ml-auto">
                <Clock size={12} className="text-text-tertiary" />
                <span className="text-[10px] text-text-tertiary font-mono">Deploy: {new Date(status.lastDeploy).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Integrations Grid */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase text-text-tertiary m-0">Integrações</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((int) => (
              <Card 
                key={int.key} 
                shadow="sm" 
                className="group hover:border-primary/40 transition-colors cursor-pointer p-4"
                onClick={() => {
                  if (int.key === 'ai') {
                    navigate('/settings/providers');
                  } else {
                    setActiveModal(int.key);
                    setConfigValue('');
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{int.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold m-0">{int.label}</p>
                    <p className="text-[10px] text-text-tertiary m-0">
                      {int.desc}
                      {settingKeyMap[int.key] && settingsData?.settings?.[settingKeyMap[int.key]] === 'configured' && (
                        <span className="text-success ml-2">• Configurado</span>
                      )}
                    </p>
                  </div>
                  <ExternalLink size={12} className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <Card shadow="sm" className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase text-text-tertiary m-0">Log de Atividade</h3>
          </div>
          <div className="flex flex-col gap-2">
            {(status?.recentEvents || []).slice(0, 8).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-4 text-[11px]">
                <span className="text-text-tertiary font-mono w-[50px]">{new Date(e.timestamp || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <Badge variant="secondary" className="text-[9px] min-w-[60px] text-center">{e.type || 'info'}</Badge>
                <span className="text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">{e.message || e.description || 'Evento'}</span>
              </div>
            ))}
            {(!status?.recentEvents || status.recentEvents.length === 0) && (
              <p className="text-xs text-text-tertiary italic">Nenhum evento recente identificado no pipeline.</p>
            )}
          </div>
        </Card>

        {/* Metrics Grid */}
        <Card shadow="sm" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-primary" />
              <h3 className="text-xs font-bold uppercase text-text-tertiary m-0">Métricas de Performance</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchMetrics()} disabled={metricsLoading}>
              {metricsLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : null} Atualizar
            </Button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div key={item.key} className="p-4 rounded-md bg-bg-secondary border border-border">
                  <div className="text-[9px] font-bold text-text-tertiary uppercase">{item.label}</div>
                  <div className="text-lg font-black font-mono mt-2 text-text-primary">
                    {value ?? '—'}{item.suffix && <span className="text-[10px] font-medium opacity-50 ml-0.5">{item.suffix}</span>}
                  </div>
                  {item.kind === 'avg' && count !== null && (
                    <div className="text-[8px] text-text-tertiary mt-1">n={count}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <h4 className="text-[10px] font-bold uppercase text-text-tertiary mb-4">Histórico Recente</h4>
            <div className="flex flex-col gap-2">
              {history.slice(0, 5).map((entry: any) => {
                const cacheHits = entry.metrics?.['cache.hit']?.value ?? 0;
                const agentLatency = entry.metrics?.['agent.latency']?.average ?? 0;
                const memorySearch = entry.metrics?.['memory.search.count']?.value ?? 0;
                return (
                  <div key={`${entry.capturedAt}-${entry.mutationCount}`} className="flex items-center justify-between px-4 py-2 bg-bg-secondary rounded-sm border border-border text-[10px]">
                    <div className="font-mono text-text-tertiary">
                      {new Date(entry.capturedAt).toLocaleTimeString('pt-BR')} <span className="opacity-30 mx-2">/</span> mut#{entry.mutationCount}
                    </div>
                    <div className="flex gap-4">
                      <span className="text-primary">hits {cacheHits}</span>
                      <span className="text-accent">lat {Math.round(agentLatency)}ms</span>
                      <span className="text-text-tertiary">mem {memorySearch}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Config Modal */}
      {activeModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setActiveModal(null)}
        >
          <Card 
            shadow="xl" 
            className="w-full max-w-[400px] p-6" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black m-0">{integrations.find((i) => i.key === activeModal)?.label}</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveModal(null)}><X size={16} /></Button>
            </div>
            <p className="text-sm text-text-tertiary mb-6">
              Insira as credenciais para ativar esta integração no pipeline.
            </p>
            <Input 
              type="password"
              value={configValue}
              onChange={(e) => setConfigValue(e.target.value)}
              placeholder="API Key / Token / Endpoint..."
              className="font-mono"
            />
            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => setActiveModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={saveConfig} disabled={saving || !configValue.trim()}>
                {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Salvar e Ativar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

