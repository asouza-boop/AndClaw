import { useToastStore } from '@/stores/toastStore';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'border-l-success bg-success/10',
  error: 'border-l-destructive bg-destructive/10',
  warn: 'border-l-warn bg-warn/10',
  info: 'border-l-primary bg-primary/10',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-md border-l-4 bg-surface-2 border border-white/[0.07] shadow-lg animate-in slide-in-from-right-5 ${styles[t.type]}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-medium">{t.title}</p>}
              <p className="text-sm text-muted-foreground">{t.message}</p>
            </div>
            <button onClick={() => removeToast(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
