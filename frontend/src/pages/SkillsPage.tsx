import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/stores/toastStore';
import { Search, Plus, RotateCcw, Zap } from 'lucide-react';
import { SkillCard, Skill } from '@/components/skills/SkillCard';
import { SkillForge } from '@/components/skills/SkillForge';

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
  const { data: skills = [] } = useQuery({ queryKey: ['skills'], queryFn: () => apiFetch('/api/skills').catch(() => []).then(ensureArray) });

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
    <div className="p-8 space-y-10 animate-in fade-in duration-700 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 px-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Skill Forge</h1>
          <p className="text-white/30 text-[13px] font-medium tracking-wide uppercase">Real-time Autonomous Capability Engineering</p>
        </div>
        
        <div className="flex gap-2 p-2 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-md">
          <button
            onClick={() => setTab('library')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-premium ${tab === 'library' ? 'bg-white text-black shadow-xl shadow-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Library
          </button>
          <button
            onClick={() => { setTab('create'); if (!editingSkill) resetChat(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-premium ${tab === 'create' ? 'bg-white text-black shadow-xl shadow-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Forge
          </button>
        </div>
      </header>

      {/* Library Tab */}
      {tab === 'library' && (
        <div className="space-y-8 px-4">
          <div className="flex items-center justify-between gap-6">
             <div className="relative flex-1 max-w-xl group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-primary transition-colors" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Analyze blueprints, slugs or capability vectors..."
                  className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white/[0.03] border border-white/5 text-[15px] font-medium text-white focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-premium placeholder:text-white/10 shadow-xl"
                />
             </div>
             <button
               onClick={() => { resetChat(); setTab('create'); }}
               className="w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-premium flex items-center justify-center shadow-lg shadow-primary/10 interactive-scale"
             >
               <Plus className="w-6 h-6" />
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSkills.map((s: Skill, i: number) => (
              <SkillCard key={s._id || s.id || i} skill={s} onEdit={editSkill} onDelete={deleteSkill} />
            ))}
            {filteredSkills.length === 0 && (
              <div className="col-span-full py-32 text-center glass-card border-dashed">
                <Zap className="w-16 h-16 text-white/5 mx-auto mb-6" />
                <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">
                  {search ? 'No Blueprints Identified' : 'Forge Status: Idle. Initialize First Scientific Skill.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Tab */}
      {tab === 'create' && (
        <div className="px-4">
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
        </div>
      )}
    </div>
  );
}
