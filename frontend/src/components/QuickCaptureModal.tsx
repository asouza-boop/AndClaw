import { useState, useEffect } from 'react';
import { X, Loader2, MessageSquare, ListTodo, Lightbulb, Link as LinkIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useQuickCaptureStore } from '@/stores/quickCaptureStore';

const types = [
  { value: 'note', label: 'Nota', icon: MessageSquare, color: 'text-warn' },
  { value: 'task', label: 'Tarefa', icon: ListTodo, color: 'text-accent' },
  { value: 'idea', label: 'Ideia', icon: Lightbulb, color: 'text-primary' },
  { value: 'link', label: 'Link', icon: LinkIcon, color: 'text-blue-400' },
];

export function QuickCaptureModal() {
  const { isOpen, close, type: defaultType } = useQuickCaptureStore();
  const [type, setType] = useState(defaultType);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setType(defaultType);
  }, [isOpen, defaultType]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/api/captures', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), type }),
      });
      toast(`${type === 'task' ? 'Tarefa' : 'Captura'} salva!`, 'success');
      setContent('');
      close();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-background/60 backdrop-blur-md animate-in fade-in duration-200" 
      onClick={close}
    >
      <div 
        className="w-full max-w-lg rounded-2xl bg-surface glow-border shadow-2xl p-6 transform animate-in slide-in-from-top-4 duration-300" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold">Captura Rápida</h2>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value as any)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ${
                type === t.value
                  ? 'bg-primary/10 border-primary/30 text-primary ring-1 ring-primary/20'
                  : 'bg-surface-2 border-transparent text-muted-foreground hover:border-white/10'
              }`}
            >
              <t.icon className={`w-4 h-4 ${type === t.value ? 'text-primary' : t.color}`} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{t.label}</span>
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === 'task' ? "O que precisa ser feito?" : "Descreva sua ideia ou nota..."}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none shadow-inner"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
        />
        
        <div className="flex items-center justify-between mt-5">
          <p className="text-[10px] text-muted-foreground">
            Pressione <kbd className="px-1 py-0.5 rounded bg-surface-3 font-sans">⌘</kbd> + <kbd className="px-1 py-0.5 rounded bg-surface-3 font-sans">Enter</kbd> para salvar
          </p>
          <div className="flex gap-2">
            <button 
              onClick={close} 
              className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !content.trim()}
              className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
