import { Loader2, RotateCcw, X, Wifi, WifiOff } from 'lucide-react';
import { useBackendStore } from '@/stores/backendStore';

export function BackendRetryIndicator() {
  const { lastFailure, isRetrying, retryLastFailure, clearFailure } = useBackendStore();

  if (!lastFailure && !isRetrying) return null;

  const retryEnabled = Boolean(lastFailure?.retryable);

  const handleRetry = async () => {
    if (!lastFailure?.retryable) return;
    await retryLastFailure();
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/90 px-5 py-3 shadow-xl backdrop-blur-md">
        <div className={`relative flex h-9 w-9 items-center justify-center rounded-full ${retryEnabled ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
          {retryEnabled ? <WifiOff className="h-4.5 w-4.5" /> : <Wifi className="h-4.5 w-4.5" />}
          {isRetrying ? <Loader2 className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 animate-spin text-primary" /> : null}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {retryEnabled ? 'Conexão falhou' : 'Conectando ao backend...'}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastFailure?.message || 'Backend indisponível'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={!retryEnabled || isRetrying}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => clearFailure()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
