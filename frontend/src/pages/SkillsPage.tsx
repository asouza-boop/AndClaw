import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/stores/toastStore';
import { Send, RotateCcw, Search, Plus, Edit3, Trash2, Zap, Users, FileText, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';

interface SkillMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Skill {
  _id?: string;
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  tools?: string[];
  sections?: string[];
  content?: string;
  integrations?: string[];
}

const SUGGESTION_CHIPS = [
  'Analisar custos AWS e detectar anomalias',
  'Monitorar alertas do Datadog e escalar incidentes',
  'Gerar relatórios de infraestrutura por cliente',
  'Sincronizar dados entre sistemas via API',
];

const WELCOME_MESSAGE: SkillMessage = {
  role: 'assistant',
  content: `Olá! Sou a **skill-creator**. Vou te ajudar a criar uma skill de alta qualidade.

Descreva o que você quer que a skill faça — pode ser algo vago. Vou fazer as perguntas certas para refinar.`,
};

function SkillCard({ skill, onEdit, onDelete }: { skill: Skill; onEdit: (s: Skill) => void; onDelete: (id: string) => void }) {
  const integrationIcons: Record<string, typeof Zap> = {
    agents: Users,
    meetings: FileText,
    memory: Brain,
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between group h-56 transition-all duration-300">
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 glass-glow-accent shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
            <h4 className="text-sm font-black text-white tracking-tight uppercase truncate">{skill.name || skill.slug || 'Skill'}</h4>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <button onClick={() => onEdit(skill)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(skill._id || skill.id || '')} className="p-2 rounded-xl bg-destructive/5 hover:bg-destructive/20 text-white/50 hover:text-destructive transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-white/40 line-clamp-2 mb-4 italic leading-relaxed">
          {skill.description || 'Nenhuma descrição técnica disponível.'}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(skill.tools || []).slice(0, 3).map((t, i) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-tighter">{t}</span>
          ))}
          {(skill.tools || []).length > 3 && (
            <span className="text-[9px] px-2 py-0.5 rounded-lg bg-white/5 text-white/30 font-bold">+{skill.tools!.length - 3} TOOL</span>
          )}
        </div>
      </div>

      {skill.integrations && skill.integrations.length > 0 && (
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          {skill.integrations.map((ig) => {
            const Icon = integrationIcons[ig] || Zap;
            return (
              <div key={ig} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-accent tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                <Icon className="w-3 h-3" />
                <span>{ig}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ preview, setPreview, onSave, saving }: { preview: string; setPreview: (v: string) => void; onSave: () => void; saving: boolean }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ slug: true, tools: true, sections: true });

  const slug = preview.match(/slug:\s*(.+)/i)?.[1]?.trim() || '';
  const toolsMatch = preview.match(/ferramentas?:\s*(.+)/i)?.[1]?.trim() || '';
  const tools = toolsMatch ? toolsMatch.split(',').map(t => t.trim()).filter(Boolean) : [];
  const sectionsMatch = preview.match(/se[çc][õo]es?:\s*(.+)/i)?.[1]?.trim() || '';
  const sections = sectionsMatch ? sectionsMatch.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggle = (key: string) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Forge Manifest</h3>

      {preview ? (
        <>
          <div className="space-y-2 mb-6">
            {[
              { key: 'slug', label: 'Slug Identification', value: slug },
              { key: 'tools', label: 'Core Tools', value: tools.join(', ') || '—' },
            ].map(({ key, label, value }) => (
              <button key={key} onClick={() => toggle(key)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs hover:bg-white/5 transition-all">
                <span className="font-bold text-white/50">{label}</span>
                <span className="text-[10px] text-white/30 truncate max-w-[150px] font-mono uppercase tracking-tighter">{value}</span>
              </button>
            ))}
          </div>

          <textarea
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            className="flex-1 w-full p-4 rounded-xl bg-black/40 border border-white/5 text-[10px] font-mono text-white/80 focus:outline-none focus:border-primary/40 scrollbar-hide resize-none leading-relaxed"
          />

          <button
            onClick={onSave}
            disabled={saving}
            className="mt-6 w-full py-4 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-white/90 disabled:opacity-30 transition-all shadow-[0_0_30px_-5px_hsla(0,0%,100%,0.2)]"
          >
            {saving ? 'Transmuting...' : 'Seal Skill Forge'}
          </button>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 px-8">
           <Zap className="w-12 h-12 mb-4" />
           <p className="text-xs font-medium italic">O blueprint estruturado será forjado aqui após o refinamento...</p>
        </div>
      )}
    </div>
  );
}

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

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
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1">Skill Forge</h1>
          <p className="text-sm text-white/40">Engenharia de capacidades autônomas em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button
            onClick={() => setTab('library')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === 'library' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Library
          </button>
          <button
            onClick={() => { setTab('create'); if (!editingSkill) resetChat(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === 'create' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Forge
          </button>
        </div>
      </header>

      {/* Library Tab */}
      {tab === 'library' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
             <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white/50 transition-colors" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome, slug ou funcionalidade..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-sm text-white focus:outline-none focus:border-primary/40 transition-all placeholder:text-white/10"
                />
             </div>
             <button
               onClick={() => { resetChat(); setTab('create'); }}
               className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
             >
               <Plus className="w-5 h-5" />
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSkills.map((s: Skill, i: number) => (
              <SkillCard key={s._id || s.id || i} skill={s} onEdit={editSkill} onDelete={deleteSkill} />
            ))}
            {filteredSkills.length === 0 && (
              <div className="col-span-full py-24 text-center glass-card">
                <Zap className="w-12 h-12 text-white/5 mx-auto mb-4" />
                <p className="text-sm font-medium text-white/40 uppercase tracking-widest">
                  {search ? 'Nenhum blueprint encontrado' : 'O Forge está livre. Crie sua primeira skill científica.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Tab */}
      {tab === 'create' && (
        <div className="flex gap-6 h-[72vh] animate-in slide-in-from-right-4 duration-500">
          {/* Chat Panel */}
          <div className="flex-[6] flex flex-col glass-card bg-gradient-to-br from-white/5 to-transparent overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 glass-glow-accent shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Skill Architect</span>
              </div>
              <button onClick={resetChat} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white/30">SA</div>
                  )}
                  <div className={`max-w-[85%] text-xs leading-relaxed ${m.role === 'user' ? 'bg-primary p-4 rounded-3xl rounded-tr-sm text-white font-medium shadow-xl' : 'text-white/80 p-1'}`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:text-white [&_strong]:font-black [&_ul]:border-l [&_ul]:border-white/10 [&_ul]:pl-4">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}

              {chatMessages.length === 1 && (
                <div className="flex flex-wrap gap-2 pl-14">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => sendChat(chip)}
                      className="text-[10px] uppercase font-black tracking-tight px-4 py-2 rounded-full border border-white/10 text-white/40 bg-white/5 hover:bg-white/10 hover:text-white transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {chatLoading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white/30 animate-pulse">SA</div>
                  <div className="flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-6 bg-black/40 border-t border-white/5">
              <div className="flex gap-4 p-2 bg-white/5 rounded-3xl border border-white/5 focus-within:border-primary/40 transition-all">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Instrua o Architect para forjar uma nova skill autônoma..."
                  rows={2}
                  className="flex-1 px-4 py-2 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none resize-none"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="self-end p-4 rounded-2xl bg-white text-black hover:bg-white/90 disabled:opacity-20 transition-all shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-[4] glass-card p-8 bg-black/60 overflow-y-auto scrollbar-hide">
            <PreviewPanel preview={preview} setPreview={setPreview} onSave={saveSkill} saving={saving} />
          </div>
        </div>
      )}
    </div>
  );
}
