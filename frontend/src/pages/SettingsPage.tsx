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

      <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* System Health */}
        <Card padding="lg" border shadow="sm">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Activity size={14} className="text-primary" />
            <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: 0 }}>Status do Sistema</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
            {[
              { label: 'Backend', icon: Server, ok: !!status?.ok },
              { label: 'Database', icon: Database, ok: !!status?.db?.ok },
              { label: 'LLM', icon: Brain, ok: !!status?.llmConfigured },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <s.icon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                <span style={{ fontSize: 'var(--text-sm)' }}>{s.label}</span>
                <Badge variant={s.ok ? 'success' : 'danger'} style={{ padding: 'var(--space-1)', borderRadius: '50%', minWidth: '8px', minHeight: '8px', height: '8px', width: '8px' }} />
              </div>
            ))}
            {status?.lastDeploy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                <Clock size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>Deploy: {new Date(status.lastDeploy).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Integrations Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Zap size={14} className="text-primary" />
            <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: 0 }}>Integrações</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {integrations.map((int) => (
              <Card 
                key={int.key} 
                padding="md" 
                border 
                shadow="none" 
                className="group hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => {
                  if (int.key === 'ai') {
                    navigate('/settings/providers');
                  } else {
                    setActiveModal(int.key);
                    setConfigValue('');
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <span style={{ fontSize: '20px' }}>{int.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', margin: 0 }}>{int.label}</p>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', margin: 0 }}>
                      {int.desc}
                      {settingKeyMap[int.key] && settingsData?.settings?.[settingKeyMap[int.key]] === 'configured' && (
                        <span style={{ color: 'var(--color-success)', marginLeft: 'var(--space-2)' }}>• Configurado</span>
                      )}
                    </p>
                  </div>
                  <ExternalLink size={12} style={{ color: 'var(--color-text-tertiary)' }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <Card padding="lg" border shadow="sm">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Settings size={14} className="text-primary" />
            <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: 0 }}>Log de Atividade</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {(status?.recentEvents || []).slice(0, 8).map((e: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: '11px' }}>
                <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', width: '50px' }}>{new Date(e.timestamp || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <Badge variant="ghost" style={{ fontSize: '9px', minWidth: '60px', textAlign: 'center' }}>{e.type || 'info'}</Badge>
                <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message || e.description || 'Evento'}</span>
              </div>
            ))}
            {(!status?.recentEvents || status.recentEvents.length === 0) && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Nenhum evento recente identificado no pipeline.</p>
            )}
          </div>
        </Card>

        {/* Metrics Grid */}
        <Card padding="lg" border shadow="sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Activity size={14} className="text-primary" />
              <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: 0 }}>Métricas de Performance</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchMetrics()} disabled={metricsLoading}>
              {metricsLoading ? <Loader2 size={12} className="animate-spin mr-2" /> : null} Atualizar
            </Button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }} className="sm:grid-cols-2 lg:grid-cols-4">
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
                <div key={item.key} style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-black)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)' }}>
                    {value ?? '—'}{item.suffix && <span style={{ fontSize: '10px', fontWeight: 'var(--font-medium)', opacity: 0.5, marginLeft: '2px' }}>{item.suffix}</span>}
                  </div>
                  {item.kind === 'avg' && count !== null && (
                    <div style={{ fontSize: '8px', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>n={count}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '10px', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>Histórico Recente</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {history.slice(0, 5).map((entry: any) => {
                const cacheHits = entry.metrics?.['cache.hit']?.value ?? 0;
                const agentLatency = entry.metrics?.['agent.latency']?.average ?? 0;
                const memorySearch = entry.metrics?.['memory.search.count']?.value ?? 0;
                return (
                  <div key={`${entry.capturedAt}-${entry.mutationCount}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '10px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
                      {new Date(entry.capturedAt).toLocaleTimeString('pt-BR')} <span style={{ opacity: 0.3, margin: '0 8px' }}>/</span> mut#{entry.mutationCount}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                      <span style={{ color: 'var(--color-primary)' }}>hits {cacheHits}</span>
                      <span style={{ color: 'var(--color-accent)' }}>lat {Math.round(agentLatency)}ms</span>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>mem {memorySearch}</span>
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
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActiveModal(null)}
        >
          <Card 
            padding="lg" 
            border 
            shadow="xl" 
            style={{ width: '100%', maxWidth: '400px' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-black)', margin: 0 }}>{integrations.find((i) => i.key === activeModal)?.label}</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveModal(null)}><X size={16} /></Button>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-6)' }}>
              Insira as credenciais para ativar esta integração no pipeline.
            </p>
            <Input 
              type="password"
              value={configValue}
              onChange={(e) => setConfigValue(e.target.value)}
              placeholder="API Key / Token / Endpoint..."
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-8)' }}>
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

