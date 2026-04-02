import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/stores/toastStore';

interface QuickCaptureModalProps {
  onClose: () => void;
}

const types = [
  { value: 'note', label: '📝 Nota' },
  { value: 'task', label: '✓ Tarefa' },
  { value: 'idea', label: '💡 Ideia' },
  { value: 'link', label: '🔗 Link' },
];

export function QuickCaptureModal({ onClose }: QuickCaptureModalProps) {
  const [type, setType] = useState('note');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/api/captures', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), type }),
      });
      toast('Captura salva!', 'success');
      onClose();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-surface glow-border p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Captura Rápida</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mb-3">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                type === t.value
                  ? 'bg-primary/20 text-primary'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="O que você quer capturar?"
          rows={4}
          className="w-full px-4 py-3 rounded-md bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          autoFocus
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={loading || !content.trim()}
            className="px-4 py-2 rounded-md bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
