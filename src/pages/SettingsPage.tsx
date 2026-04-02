import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Server, Database, Brain, Clock, ExternalLink, X, Loader2 } from 'lucide-react';

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
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => apiFetch<any>('/api/status').catch(() => null) });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState('');
  const [saving, setSaving] = useState(false);

  const saveConfig = async () => {
    if (!activeModal || !configValue.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [activeModal]: configValue.trim() }),
      });
      toast('Configuração salva', 'success');
      setActiveModal(null);
      setConfigValue('');
      qc.invalidateQueries({ queryKey: ['status'] });
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Health */}
      <div className="rounded-xl bg-surface glow-border p-5">
        <h3 className="text-sm font-semibold mb-4">Status do Sistema</h3>
        <div className="flex gap-6">
          {[
            { label: 'Backend', icon: Server, ok: !!status },
            { label: 'Database', icon: Database, ok: status?.db !== false },
            { label: 'LLM', icon: Brain, ok: status?.llm !== false },
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
              onClick={() => { setActiveModal(int.key); setConfigValue(''); }}
              className="flex items-center gap-4 p-4 rounded-xl bg-surface glow-border text-left transition-colors hover:bg-surface-2 group"
            >
              <span className="text-2xl">{int.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{int.label}</p>
                <p className="text-xs text-muted-foreground">{int.desc}</p>
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
