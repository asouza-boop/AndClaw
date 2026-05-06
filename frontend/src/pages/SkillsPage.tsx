import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { useState } from 'react';
import { toast } from '@/stores/toastStore';
import { Search, Plus, Zap, Box, Target } from 'lucide-react';
import { SkillCard, Skill } from '@/components/skills/SkillCard';
import { SkillForge } from '@/components/skills/SkillForge';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';

const SUGGESTION_CHIPS = [
  'Analisar custos AWS e detectar anomalias',
  'Monitorar alertas do Datadog e escalar incidentes',
  'Gerar relatórios de infraestrutura por cliente',
  'Sincronizar dados entre sistemas via API',
];

interface SkillMessage {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MESSAGE: SkillMessage = {
  role: 'assistant',
  content: `Olá! Sou a **skill-creator**. Vou te ajudar a criar uma skill de alta qualidade.

Descreva o que você quer que a skill faça — pode ser algo vago. Vou fazer as perguntas certas para refinar.`,
};

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const { data: skills = [], isLoading } = useQuery({ 
    queryKey: ['skills'], 
    queryFn: () => apiFetch('/api/skills').catch(() => []).then(ensureArray) 
  });

  const [tab, setTab] = useState<'library' | 'create'>('library');
  const [search, setSearch] = useState('');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<SkillMessage[]>([WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredSkills = skills.filter((s: Skill) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name || s.slug || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
  });

  const sendChat = async (msg?: string) => {
    const text = (msg || chatInput).trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(p => [...p, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      const res = await apiFetch<any>('/api/skill-chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history: chatMessages }),
      });
      const response = res.response || res.message || '';
      setChatMessages(p => [...p, { role: 'assistant', content: response }]);
      const match = response.match(/INICIO_SKILL([\s\S]*?)FIM_SKILL/);
      if (match) setPreview(match[1].trim());
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const resetChat = () => {
    setChatMessages([WELCOME_MESSAGE]);
    setPreview('');
    setEditingSkill(null);
  };

  const saveSkill = async () => {
    setSaving(true);
    try {
      const method = editingSkill ? 'PUT' : 'POST';
      const path = editingSkill ? `/api/skills/${editingSkill._id || editingSkill.id}` : '/api/skills';
      await apiFetch(path, { method, body: JSON.stringify({ content: preview }) });
      toast(editingSkill ? 'Skill atualizada!' : 'Skill salva!', 'success');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      resetChat();
      setTab('library');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async (id: string) => {
    try {
      await apiFetch(`/api/skills/${id}`, { method: 'DELETE' });
      toast('Skill removida', 'success');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const editSkill = (skill: Skill) => {
    setEditingSkill(skill);
    setPreview(skill.content || '');
    setTab('create');
    setChatMessages([
      WELCOME_MESSAGE,
      { role: 'assistant', content: `Carregando skill **${skill.name || skill.slug}** para edição. Faça as alterações desejadas na prévia ou me peça para melhorar algo.` },
    ]);
  };

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Skills" 
        subtitle={`${skills.length} capacidades modulares`}
        actions={
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <Button
              variant={tab === 'library' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab('library')}
              style={{ borderRadius: 0, border: 'none' }}
            >
              <Zap size={14} className="mr-2" /> Biblioteca
            </Button>
            <Button
              variant={tab === 'create' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setTab('create'); if (!editingSkill) resetChat(); }}
              style={{ borderRadius: 0, border: 'none' }}
            >
              <Plus size={14} className="mr-2" /> Forge
            </Button>
          </div>
        }
      />

      <div style={{ marginTop: 'var(--space-8)' }}>
        {/* Library Tab */}
        {tab === 'library' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <div style={{ flex: 1, maxWidth: '400px' }}>
                <Input 
                  placeholder="Buscar skills ou vetores..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {filteredSkills.length} resultados
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => { resetChat(); setTab('create'); }}
                style={{ marginLeft: 'auto' }}
              >
                <Plus size={14} className="mr-2" /> Criar Skill
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
              {filteredSkills.map((s: Skill, i: number) => (
                <SkillCard key={s._id || s.id || i} skill={s} onEdit={editSkill} onDelete={deleteSkill} />
              ))}
              
              {filteredSkills.length === 0 && !isLoading && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <EmptyState 
                    icon={<Box size={40} />}
                    title={search ? "Nenhuma skill encontrada" : "Biblioteca Vazia"}
                    description={search ? "Tente termos mais genéricos ou crie uma nova skill." : "Initialize sua primeira capacidade autônoma no Forge."}
                    action={!search ? <Button variant="primary" onClick={() => setTab('create')}>Abrir Forge</Button> : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create/Edit Tab */}
        {tab === 'create' && (
          <SkillForge 
            chatMessages={chatMessages}
            chatInput={chatInput}
            chatLoading={chatLoading}
            preview={preview}
            saving={saving}
            suggestionChips={SUGGESTION_CHIPS}
            setChatInput={setChatInput}
            setPreview={setPreview}
            onSend={sendChat}
            onReset={resetChat}
            onSave={saveSkill}
          />
        )}
      </div>
    </AppLayout>
  );
}

