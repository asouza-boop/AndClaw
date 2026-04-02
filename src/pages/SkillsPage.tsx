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
    <div className="group rounded-xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.2)] transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <h4 className="text-sm font-semibold text-foreground">{skill.name || skill.slug || 'Skill'}</h4>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(skill)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(skill._id || skill.id || '')} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{skill.description || 'Sem descrição'}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {(skill.tools || []).slice(0, 4).map((t, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">{t}</span>
        ))}
        {(skill.tools || []).length > 4 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{skill.tools!.length - 4}</span>
        )}
      </div>

      {skill.integrations && skill.integrations.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Integrações:</span>
          {skill.integrations.map((ig) => {
            const Icon = integrationIcons[ig] || Zap;
            return (
              <div key={ig} className="flex items-center gap-1 text-[10px] text-accent">
                <Icon className="w-3 h-3" />
                <span className="capitalize">{ig}</span>
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

  // Parse preview to extract structured fields
  const slug = preview.match(/slug:\s*(.+)/i)?.[1]?.trim() || '';
  const toolsMatch = preview.match(/ferramentas?:\s*(.+)/i)?.[1]?.trim() || '';
  const tools = toolsMatch ? toolsMatch.split(',').map(t => t.trim()).filter(Boolean) : [];
  const sectionsMatch = preview.match(/se[çc][õo]es?:\s*(.+)/i)?.[1]?.trim() || '';
  const sections = sectionsMatch ? sectionsMatch.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggle = (key: string) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Prévia do Skill.md</h3>

      {preview ? (
        <>
          <div className="space-y-2 mb-4">
            {[
              { key: 'slug', label: 'Slug', value: slug },
              { key: 'tools', label: 'Ferramentas', value: tools.join(', ') || '—' },
              { key: 'sections', label: 'Seções', value: sections.join(', ') || '—' },
            ].map(({ key, label, value }) => (
              <button key={key} onClick={() => toggle(key)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:border-primary/30 transition-colors">
                <span className="font-medium text-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{value}</span>
                  {expandedSections[key] ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>
            ))}
          </div>

          <textarea
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            className="flex-1 w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />

          <button
            onClick={onSave}
            disabled={saving}
            className="mt-3 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Salvando...' : 'Salvar Skill'}
          </button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          O SKILL.md gerado aparece aqui para você revisar e editar antes de salvar...
        </p>
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
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capacidades carregadas do sistema <code className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">.agents/skills/</code>
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('library')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'library' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Biblioteca
          </button>
          <button
            onClick={() => { setTab('create'); if (!editingSkill) resetChat(); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'create' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Skill
          </button>
        </div>

        {tab === 'library' && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
              />
            </div>
            <button
              onClick={() => { resetChat(); setTab('create'); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Nova Skill
            </button>
          </div>
        )}
      </div>

      {/* Library Tab */}
      {tab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((s: Skill, i: number) => (
            <SkillCard key={s._id || s.id || i} skill={s} onEdit={editSkill} onDelete={deleteSkill} />
          ))}
          {filteredSkills.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Nenhuma skill encontrada' : 'Nenhuma skill cadastrada. Crie a primeira!'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Tab */}
      {tab === 'create' && (
        <div className="flex gap-5 h-[68vh]">
          {/* Chat Panel */}
          <div className="flex-[6] flex flex-col rounded-xl bg-card border border-border overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-2/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm font-medium text-foreground">skill-creator</span>
                <span className="text-xs text-muted-foreground">· guia a criação passo a passo</span>
              </div>
              <button onClick={resetChat} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent">SC</div>
                  )}
                  <div className={`max-w-[80%] text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary/10 border border-primary/20 rounded-xl rounded-tr-sm px-4 py-3 text-foreground' : 'text-foreground'}`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}

              {/* Suggestion chips after welcome */}
              {chatMessages.length === 1 && (
                <div className="flex flex-wrap gap-2 pl-11">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => sendChat(chip)}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/15 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent">SC</div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Descreva a skill que você quer criar... Ex: 'Quero uma skill que analisa custos AWS e gera relatórios de anomalias'"
                  rows={2}
                  className="flex-1 px-4 py-3 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="self-end px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-[4] rounded-xl bg-card border border-border p-5 overflow-y-auto">
            <PreviewPanel preview={preview} setPreview={setPreview} onSave={saveSkill} saving={saving} />
          </div>
        </div>
      )}
    </div>
  );
}
