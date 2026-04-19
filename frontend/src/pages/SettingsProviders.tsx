import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { 
  Server, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  Play, 
  ChevronLeft,
  Settings2,
  ShieldCheck,
  Zap,
  Power,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface Provider {
  id: string;
  name: string;
  api_key: string;
  base_url?: string;
  model: string;
  priority: number;
  enabled: boolean;
}

export default function SettingsProviders() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: providers, isLoading } = useQuery({ 
    queryKey: ['llm-providers'], 
    queryFn: () => apiFetch<{ items: Provider[] }>('/api/llm/providers').then(res => res.items) 
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newProvider, setNewProvider] = useState<Partial<Provider>>({
    name: '',
    model: '',
    api_key: '',
    priority: 0,
    enabled: true
  });

  const createMutation = useMutation({
    mutationFn: (p: Partial<Provider>) => apiFetch('/api/llm/providers', { method: 'POST', body: JSON.stringify({ ...p, id: p.name?.toLowerCase().replace(/\s/g, '-') }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] });
      setIsAdding(false);
      toast('Provider adicionado', 'success');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => apiFetch(`/api/llm/providers/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-providers'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/llm/providers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] });
      toast('Provider removido', 'success');
    }
  });

  const testMutation = useMutation({
    mutationFn: (name: string) => apiFetch('/api/llm/providers/test', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: (res: any) => toast(res.message, 'success'),
    onError: (err: any) => toast(err.message, 'error')
  });

  const handleCreate = () => {
    if (!newProvider.name || !newProvider.model) return;
    createMutation.mutate(newProvider);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LLM Providers</h1>
          <p className="text-sm text-muted-foreground italic">Gerencie múltiplos provedores e fallbacks inteligentes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-surface rounded-xl border border-white/5" />)}
            </div>
          ) : providers?.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-white/5 bg-surface/30">
              <Server className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">Nenhum provedor configurado ainda.</p>
              <Button variant="link" onClick={() => setIsAdding(true)}>Adicionar o primeiro</Button>
            </div>
          ) : (
            providers?.map((p) => (
              <div key={p.id} className="group relative rounded-2xl bg-surface glow-border p-5 transition-all hover:bg-surface-2">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-xl bg-primary/10 text-primary ${p.enabled ? '' : 'grayscale opacity-50'}`}>
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${p.enabled ? '' : 'text-muted-foreground line-through opacity-50'}`}>{p.name}</h3>
                        <Badge variant={p.enabled ? 'outline' : 'secondary'} className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 h-4">
                          {p.enabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.model}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-7 text-[11px] gap-1.5 bg-white/5 hover:bg-white/10"
                          onClick={() => testMutation.mutate(p.name)}
                          disabled={testMutation.isPending || !p.enabled}
                        >
                          <Play className="w-3 h-3" /> Testar Conexão
                        </Button>
                        <Badge variant="secondary" className="bg-transparent border-white/5 text-[10px] text-muted-foreground">
                          Prioridade: {p.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end gap-1 px-4">
                        <Switch 
                          checked={p.enabled} 
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: p.id, enabled: checked })} 
                        />
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive transition-colors rounded-full h-8 w-8"
                        onClick={() => deleteMutation.mutate(p.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          {!isAdding && (
            <Button 
                variant="outline" 
                className="w-full border-dashed border-2 py-8 rounded-2xl bg-transparent hover:bg-white/[0.02] hover:border-white/10 text-muted-foreground group"
                onClick={() => setIsAdding(true)}
            >
              <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Adicionar novo provedor
            </Button>
          )}

          {isAdding && (
            <div className="rounded-2xl bg-surface glow-border p-6 space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground opacity-50">Novo Provedor</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancelar</Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome</label>
                        <Input 
                            placeholder="ex: Gemini Pro" 
                            className="bg-surface-2 border-white/5 h-11"
                            value={newProvider.name}
                            onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Modelo</label>
                        <Input 
                            placeholder="ex: gemini-2.0-flash" 
                            className="bg-surface-2 border-white/5 h-11"
                            value={newProvider.model}
                            onChange={(e) => setNewProvider({...newProvider, model: e.target.value})}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">API Key</label>
                    <Input 
                        type="password"
                        placeholder="Insira a chave de API..." 
                        className="bg-surface-2 border-white/5 h-11"
                        value={newProvider.api_key}
                        onChange={(e) => setNewProvider({...newProvider, api_key: e.target.value})}
                    />
                </div>
                <div className="flex gap-4">
                    <div className="w-1/3 space-y-2">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Prioridade (0-99)</label>
                        <Input 
                            type="number"
                            className="bg-surface-2 border-white/5 h-11"
                            value={newProvider.priority}
                            onChange={(e) => setNewProvider({...newProvider, priority: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <div className="flex-1 space-y-2">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Custom Base URL (Opcional)</label>
                        <Input 
                            placeholder="https://..." 
                            className="bg-surface-2 border-white/5 h-11"
                            value={newProvider.base_url}
                            onChange={(e) => setNewProvider({...newProvider, base_url: e.target.value})}
                        />
                    </div>
                </div>
                <Button className="w-full h-12 rounded-xl mt-4" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando...' : 'Salvar Provedor'}
                </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
            <div className="rounded-2xl bg-surface glow-border p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                    <ShieldCheck className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Safe Fallback</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O sistema defallback está configurado para tentar o provedor de maior prioridade primeiro. Se falhar, ele tentará o próximo na lista de forma automática.
                </p>
                <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Retentativas máximas</span>
                        <span className="font-mono text-foreground font-bold">1</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Latência Adicional</span>
                        <span className="font-mono text-warning font-bold">~200ms</span>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl bg-surface glow-border p-5 space-y-4">
                <div className="flex items-center gap-2 text-accent">
                    <RefreshCw className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Auto-Refresh</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configurações de rede e modelos locais (Ollama) são validadas em tempo real antes da execução do Agent Loop.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
