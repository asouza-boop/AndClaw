import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { 
  Plus, X, Trash2, ChevronRight, Bot, Loader2, 
  BrainCircuit, Sparkles, Database, Zap, Shield, 
  Cpu, Activity, Settings2, Sliders
} from 'lucide-react';
import { AgentsSkeleton } from '@/components/PageSkeletons';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

/* ─── FUI Configs ─── */
const levels = ['Estratégico', 'Tático', 'Operacional'];
const levelVariants: Record<string, 'primary' | 'info' | 'success' | 'default'> = {
  'Estratégico': 'primary',
  'Tático': 'info',
  'Operacional': 'success',
};

// Skill Forge Map (FUI Concept)
const skillMap: Record<string, { label: string; icon: any; color: string }> = {
  'task-manager':   { label: 'Gestão de Tarefas', icon: Zap, color: '#fbbf24' },
  'code-reviewer':  { label: 'Revisor de Código', icon: Cpu, color: '#6366f1' },
  'meeting-notes':  { label: 'Transcrição', icon: Activity, color: '#2dd4bf' },
  'knowledge-base': { label: 'Síntese LTM', icon: Database, color: '#c084fc' },
  'security':       { label: 'Segurança', icon: Shield, color: '#f87171' },
};

function AgentCard({ agent, onDelete }: { agent: any; onDelete: () => void }) {
  const status = agent.status || 'active';
  const level = agent.level || 'Tático';
  const ltmProgress = Math.floor(Math.random() * 40) + 60; // Mock LTM sync
  
  return (
    <Card padding="none" border shadow="none" className="group glass-card-v2" style={{ overflow: 'hidden', position: 'relative' }}>
      {/* Noise Texture Overlay */}
      <div className="fui-noise-overlay" style={{ position: 'absolute', opacity: 0.05 }} />

      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '12px', 
              backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)'
            }}>
              <Bot size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>{agent.name}</h4>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>ID: {agent._id?.slice(-6).toUpperCase() || 'AGENT-X'}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {status === 'active' && <div className="fui-ping-active" title="Ativo em Loop ReAct" />}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDelete} 
              style={{ padding: 0, width: '28px', height: '28px', color: 'rgba(248, 113, 113, 0.5)' }}
              className="hover:text-red-400"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
        
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)', margin: 0 }}>
          {agent.description || 'Nenhuma diretriz neural configurada.'}
        </p>

        {/* Skill Forge Visualization */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-4)' }}>
          {(agent.skills || []).map((s: string, i: number) => {
            const sInfo = skillMap[s] || { label: s, icon: Sparkles, color: 'var(--color-text-tertiary)' };
            const Icon = sInfo.icon;
            return (
              <div key={i} style={{ 
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '4px 10px', borderRadius: 'var(--radius-full)', 
                backgroundColor: 'rgba(255,255,255,0.03)', color: sInfo.color,
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <Icon size={10} /> {sInfo.label}
              </div>
            );
          })}
        </div>

        {/* LTM Sync Progress */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
            <span>Sincronização LTM</span>
            <span>{ltmProgress}%</span>
          </div>
          <div style={{ height: '2px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
            <div 
              className="fui-shimmer-ltm" 
              style={{ width: `${ltmProgress}%`, height: '100%', borderRadius: '1px' }} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge variant={levelVariants[level] || 'default'} style={{ fontSize: '9px', padding: '1px 8px' }}>{level}</Badge>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '12px', height: '2px', backgroundColor: 'var(--color-accent)', borderRadius: '1px' }} />
            <div style={{ width: '4px', height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '1px' }} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['agents'], queryFn: () => apiFetch('/api/agents').then(ensureArray) });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ 
    name: '', level: 'Tático', status: 'active', description: '', areas: '', skills: '', base_doc: '',
    personality: 50 // 0: Precision, 100: Creativity
  });

  const deleteAgent = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); toast('Agente desativado do núcleo', 'success'); },
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
      toast('Novo núcleo de IA calibrado!', 'success');
      setWizardOpen(false);
      setStep(0);
      setForm({ name: '', level: 'Tático', status: 'active', description: '', areas: '', skills: '', base_doc: '', personality: 50 });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const columns = levels.map((level) => ({
    level,
    agents: agents.filter((a: any) => (a.level || 'Tático') === level),
  }));

  if (isLoading) return <AgentsSkeleton />;

  return (
    <div className="w-full animate-in fade-in duration-700">
      <PageHeader 
        title="Hub de Agentes" 
        subtitle={`${agents.length} Núcleos Ativos · Triarquia Neural Configurada`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)} style={{ borderRadius: 'var(--radius-full)', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)' }}>
            <BrainCircuit size={14} className="mr-2" /> CALIBRAR NOVO AGENTE
          </Button>
        }
      />

      <div style={{ marginTop: 'var(--space-8)', display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 'var(--space-6)' }} className="lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.level} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-2)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>{col.level}</span>
                <Badge variant={levelVariants[col.level] || 'default'} style={{ height: '4px', width: '20px', padding: 0 }} />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>[{col.agents.length}]</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {col.agents.length === 0 ? (
                <div style={{ height: '120px', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Cpu size={24} style={{ color: 'rgba(255,255,255,0.05)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Nenhum Núcleo Ativo</span>
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

      {/* Wizard Modal - FUI Calibration Style */}
      {wizardOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5, 6, 15, 0.8)', backdropFilter: 'blur(10px)' }}>
          <Card padding="none" border shadow="md" className="glass-panel-v2" style={{ width: '100%', maxWidth: '520px', overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--color-accent-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                  <Settings2 size={18} />
                </div>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: 0 }}>Calibração de Núcleo <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>— Step {step + 1}/4</span></h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setWizardOpen(false)} style={{ color: 'var(--color-text-tertiary)' }}><X size={18} /></Button>
            </div>

            <div style={{ padding: 'var(--space-8)', minHeight: '340px' }}>
              {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>Identificação</label>
                    <Input placeholder="Ex: Orion Intelligence" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>Hierarquia Neural</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {levels.map(l => (
                        <button
                          key={l}
                          onClick={() => setForm({ ...form, level: l })}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '11px', fontWeight: 600,
                            backgroundColor: form.level === l ? 'var(--color-accent-sub)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${form.level === l ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)'}`,
                            color: form.level === l ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>Diretriz Principal</label>
                    <textarea 
                      value={form.description} 
                      onChange={(e) => setForm({ ...form, description: e.target.value })} 
                      rows={2} 
                      placeholder="Qual o propósito fundamental deste agente?"
                      style={{
                        width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)',
                        resize: 'none', outline: 'none', color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>
                </div>
              )}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>Módulos de Skill (Skill Forge)</label>
                    <Input label="IDs das Skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="task-manager, knowledge-base, security" />
                    <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Separe por vírgula para injetar múltiplos módulos ativos.</p>
                  </div>
                  
                  {/* Personality Calibration Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Sliders size={14} style={{ color: 'var(--color-accent)' }} />
                      <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>Tom Neural (Personalidade)</label>
                    </div>
                    <div style={{ padding: '0 8px' }}>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={form.personality} 
                        onChange={(e) => setForm({ ...form, personality: parseInt(e.target.value) })}
                        className="fui-slider" 
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '9px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                        <span style={{ color: form.personality < 50 ? 'var(--color-accent)' : 'inherit' }}>Precisão / Fatos</span>
                        <span style={{ color: form.personality >= 50 ? 'var(--color-accent)' : 'inherit' }}>Criatividade / Fluxo</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>Córtex Central (Instruções Base)</label>
                  <textarea 
                    value={form.base_doc} 
                    onChange={(e) => setForm({ ...form, base_doc: e.target.value })} 
                    rows={8} 
                    style={{
                      width: '100%', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: '12px',
                      fontFamily: 'var(--font-mono)', resize: 'none', outline: 'none', color: 'var(--color-text-secondary)',
                      lineHeight: 1.6
                    }}
                    placeholder="Injete aqui o prompt de sistema e diretrizes de comportamento..."
                  />
                </div>
              )}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-success)' }}>
                    <Zap size={20} />
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0 }}>Calibração Concluída</p>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-tertiary)' }}>NÚCLEO:</span> <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{form.name}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-tertiary)' }}>HIEARARQUIA:</span> <span>{form.level}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-tertiary)' }}>PERSONALIDADE:</span> <span>{form.personality < 50 ? 'Analítica' : 'Criativa'} ({form.personality}%)</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-tertiary)' }}>SKILLS:</span> <span>{form.skills || 'Nenhuma'}</span></div>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 'var(--space-4)' }}>
                    Ao confirmar, o núcleo será injetado na triarquia neural do AndClaw.
                  </p>
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ fontSize: '11px' }}
              >
                VOLTAR
              </Button>
              {step < 3 ? (
                <Button variant="secondary" onClick={() => setStep((s) => s + 1)} style={{ fontSize: '11px', borderRadius: 'var(--radius-full)' }}>
                  PRÓXIMO PASSO <ChevronRight size={14} className="ml-2" />
                </Button>
              ) : (
                <Button variant="primary" onClick={createAgent} style={{ fontSize: '11px', borderRadius: 'var(--radius-full)', paddingLeft: '24px', paddingRight: '24px' }}>
                  INJETAR NO NÚCLEO
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}


