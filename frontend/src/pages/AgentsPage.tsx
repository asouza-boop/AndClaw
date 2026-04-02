import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Plus, X, Pencil, Trash2, ChevronRight } from 'lucide-react';

const levels = ['Estratégico', 'Tático', 'Operacional'];
const levelColors: Record<string, string> = {
  'Estratégico': 'bg-primary/10 text-primary border-primary/20',
  'Tático': 'bg-accent/10 text-accent border-accent/20',
  'Operacional': 'bg-success/10 text-success border-success/20',
};

function AgentCard({ agent, onDelete }: { agent: any; onDelete: () => void }) {
  const status = agent.status || 'active';
  return (
    <div className="rounded-xl bg-surface glow-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{agent.name}</h4>
        <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-success' : 'bg-muted-foreground'}`} />
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{agent.description || 'Sem descrição'}</p>
      <div className="flex flex-wrap gap-1">
        {(agent.areas || []).slice(0, 3).map((a: string, i: number) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">{a}</span>
        ))}
      </div>
      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onDelete} className="p-1 rounded hover:bg-surface-3 text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => apiFetch('/api/agents').then(ensureArray) });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', level: 'Tático', status: 'active', description: '', areas: '', skills: '', base_doc: '' });

  const deleteAgent = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); toast('Agente excluído', 'success'); },
    onError: (e: any) => toast(e.message, 'error'),
  });

  const createAgent = async () => {
    try {
      await apiFetch('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          areas: form.areas.split(',').map((s) => s.trim()).filter(Boolean),
          skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast('Agente criado!', 'success');
      setWizardOpen(false);
      setStep(0);
      setForm({ name: '', level: 'Tático', status: 'active', description: '', areas: '', skills: '', base_doc: '' });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const columns = levels.map((level) => ({
    level,
    agents: agents.filter((a: any) => (a.level || 'Tático') === level),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agentes</h2>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Agente
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.level}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded border ${levelColors[col.level]}`}>{col.level}</span>
              <span className="text-xs text-muted-foreground">{col.agents.length}</span>
            </div>
            <div className="space-y-3">
              {col.agents.map((a: any) => (
                <div key={a._id || a.id} className="group">
                  <AgentCard agent={a} onDelete={() => deleteAgent.mutate(a._id || a.id)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-surface glow-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold">Novo Agente — Passo {step + 1}/4</h3>
              <button onClick={() => setWizardOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nível</label>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="w-full px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm focus:outline-none">
                    {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Áreas (separadas por vírgula)</label>
                  <input value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} className="w-full px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="produtividade, estratégia, código" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Skills (separadas por vírgula)</label>
                  <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="w-full px-3 py-2 border border-white/[0.07] rounded-md bg-surface-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="task-manager, code-reviewer" />
                </div>
              </div>
            )}
            {step === 2 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Documento base</label>
                <textarea value={form.base_doc} onChange={(e) => setForm({ ...form, base_doc: e.target.value })} rows={8} className="w-full px-3 py-2 rounded-md bg-surface-2 border border-white/[0.07] text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="Contexto e instruções do agente..." />
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Revisão final:</p>
                <div className="p-4 rounded-lg bg-surface-2 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Nome:</span> {form.name}</p>
                  <p><span className="text-muted-foreground">Nível:</span> {form.level}</p>
                  <p><span className="text-muted-foreground">Descrição:</span> {form.description}</p>
                  <p><span className="text-muted-foreground">Áreas:</span> {form.areas}</p>
                  <p><span className="text-muted-foreground">Skills:</span> {form.skills}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                Voltar
              </button>
              {step < 3 ? (
                <button onClick={() => setStep((s) => s + 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                  Próximo <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button onClick={createAgent} className="px-4 py-1.5 rounded-md bg-gradient-to-r from-primary to-accent text-white text-sm font-medium hover:opacity-90">
                  Criar Agente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
