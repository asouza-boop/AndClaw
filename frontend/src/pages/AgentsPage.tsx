import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Plus, X, Trash2, ChevronRight, Bot, Loader2 } from 'lucide-react';
import { AgentsSkeleton } from '@/components/PageSkeletons';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const levels = ['Estratégico', 'Tático', 'Operacional'];
const levelVariants: Record<string, 'primary' | 'info' | 'success' | 'default'> = {
  'Estratégico': 'primary',
  'Tático': 'info',
  'Operacional': 'success',
};

function AgentCard({ agent, onDelete }: { agent: any; onDelete: () => void }) {
  const status = agent.status || 'active';
  const level = agent.level || 'Tático';
  
  return (
    <Card padding="sm" border shadow="sm" className="group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{agent.name}</h4>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: status === 'active' ? 'var(--color-success)' : 'var(--color-text-tertiary)' 
        }} />
      </div>
      
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', margin: 0 }} className="line-clamp-2">
        {agent.description || 'Sem descrição'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
        {(agent.areas || []).slice(0, 3).map((a: string, i: number) => (
          <span key={i} style={{ 
            fontSize: '9px', 
            padding: '2px 6px', 
            borderRadius: 'var(--radius-sm)', 
            backgroundColor: 'var(--color-bg-tertiary)', 
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase'
          }}>
            {a}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Badge variant={levelVariants[level] || 'default'}>{level}</Badge>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDelete} 
          style={{ padding: 0, width: '24px', height: '24px', color: 'var(--color-error)' }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  );
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['agents'], queryFn: () => apiFetch('/api/agents').then(ensureArray) });
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

  if (isLoading) {
    return <AgentsSkeleton />;
  }

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Agentes" 
        subtitle={`${agents.length} assistentes configurados`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)}>
            <Plus size={14} className="mr-2" /> Novo Agente
          </Button>
        }
      />

      <div style={{ marginTop: 'var(--space-8)', display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 'var(--space-8)' }} className="lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.level} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-1)' }}>
              <Badge variant={levelVariants[col.level] || 'default'}>{col.level}</Badge>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>[{col.agents.length}]</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {col.agents.length === 0 ? (
                <div style={{ height: '80px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Nenhum agente</span>
                </div>
              ) : (
                col.agents.map((a: any) => (
                  <AgentCard key={a._id || a.id} agent={a} onDelete={() => deleteAgent.mutate(a._id || a.id)} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Wizard Modal */}
      {wizardOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropBlur: '4px' }}>
          <Card padding="lg" border shadow="md" style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Novo Agente — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{step + 1}/4</span></h3>
              <Button variant="ghost" size="sm" onClick={() => setWizardOpen(false)}><X size={16} /></Button>
            </div>

            <div style={{ minHeight: '300px' }}>
              {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Nível</label>
                    <select 
                      value={form.level} 
                      onChange={(e) => setForm({ ...form, level: e.target.value })}
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-sm)',
                        outline: 'none'
                      }}
                    >
                      {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Descrição</label>
                    <textarea 
                      value={form.description} 
                      onChange={(e) => setForm({ ...form, description: e.target.value })} 
                      rows={3} 
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-3)',
                        fontSize: 'var(--text-sm)',
                        resize: 'none',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <Input label="Áreas" value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} placeholder="produtividade, estratégia, código" />
                  <Input label="Skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="task-manager, code-reviewer" />
                </div>
              )}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>Documento base</label>
                  <textarea 
                    value={form.base_doc} 
                    onChange={(e) => setForm({ ...form, base_doc: e.target.value })} 
                    rows={8} 
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-mono)',
                      resize: 'none',
                      outline: 'none'
                    }}
                    placeholder="Contexto e instruções do agente..."
                  />
                </div>
              )}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>Revisão final:</p>
                  <div style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <p><span style={{ color: 'var(--color-text-tertiary)' }}>Nome:</span> {form.name}</p>
                    <p><span style={{ color: 'var(--color-text-tertiary)' }}>Nível:</span> {form.level}</p>
                    <p><span style={{ color: 'var(--color-text-tertiary)' }}>Descrição:</span> {form.description}</p>
                    <p><span style={{ color: 'var(--color-text-tertiary)' }}>Áreas:</span> {form.areas}</p>
                    <p><span style={{ color: 'var(--color-text-tertiary)' }}>Skills:</span> {form.skills}</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Voltar
              </Button>
              {step < 3 ? (
                <Button variant="secondary" onClick={() => setStep((s) => s + 1)}>
                  Próximo <ChevronRight size={14} className="ml-2" />
                </Button>
              ) : (
                <Button variant="primary" onClick={createAgent}>
                  Criar Agente
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

