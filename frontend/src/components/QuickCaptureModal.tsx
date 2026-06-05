import { useState, useEffect } from 'react';
import { X, Loader2, MessageSquare, ListTodo, Lightbulb, Link as LinkIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
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
      toast(`${type === 'task' ? 'Operation' : 'Signal'} captured!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['captures'] });
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
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-[#050507]/60 backdrop-blur-xl animate-in fade-in duration-300" 
      onClick={close}
    >
      <div 
        className="w-full max-w-xl glass-panel-v2 p-10 transform animate-in slide-in-from-top-8 duration-500 shadow-[0_32px_128px_-32px_rgba(0,0,0,1)] border-white/10" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">Quick Signal Capture</h2>
          </div>
          <button onClick={close} className="p-2.5 rounded-xl hover:bg-white/5 transition-premium text-white/20 hover:text-white interactive-scale">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-3 mb-8">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value as any)}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border transition-premium interactive-scale ${
                type === t.value
                  ? 'bg-white text-black border-white shadow-xl shadow-white/5'
                  : 'bg-white/5 border-white/5 text-white/20 hover:border-white/20 hover:text-white/40'
              }`}
            >
              <t.icon className={`w-4 h-4 ${type === t.value ? 'text-black' : t.color}`} />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2 mb-8">
           <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={type === 'task' ? "What is the next operational protocol?" : "Stream cognitive fragments into the library..."}
            rows={4}
            className="w-full px-6 py-5 rounded-2xl bg-white/[0.03] border border-white/10 text-[15px] font-medium text-white placeholder:text-white/10 focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-premium resize-none shadow-inner"
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
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
            <kbd className="text-[10px] font-black text-white/40 font-mono">⌘</kbd>
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">+ ENTER TO COMMIT</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={close} 
              className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white/20 hover:text-white hover:bg-white/5 transition-premium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !content.trim()}
              className="px-10 py-3 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-white/5 hover:bg-primary hover:text-white disabled:opacity-20 transition-premium flex items-center gap-3 interactive-scale"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Commit Signal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
