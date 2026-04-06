import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useBackendStore } from '@/stores/backendStore';

type RuntimeHealth = {
  ok: boolean;
  bootstrapped: boolean;
  ready: boolean;
  retryable: boolean;
  retryAfterMs?: number;
  db?: { ok?: boolean; latencyMs?: number | null; error?: string };
  lastDeploy?: string | null;
  requestId?: string | null;
};

export function BackendRetryBanner() {
  const { lastFailure, isRetrying, retryLastFailure, clearFailure } = useBackendStore();

  const runtime = useQuery({
    queryKey: ['backend-runtime'],
    queryFn: () => apiFetch<RuntimeHealth>('/api/health/runtime'),
    refetchInterval: 30000,
    retry: false,
  });

  const runtimeData = runtime.data;
  const runtimeError = runtime.error as any;
  const hasRuntimeIssue = Boolean(runtimeError) || Boolean(runtimeData && (!runtimeData.ok || runtimeData.retryable));
  const hasFailure = Boolean(lastFailure);
  const visible = hasFailure || hasRuntimeIssue;

  if (!visible) return null;

  const title = lastFailure?.message
    || runtimeError?.message
    || (runtimeData?.ok ? 'Backend disponível' : 'Backend inicializando');

  const details = lastFailure
    ? `${lastFailure.method} ${lastFailure.path}${lastFailure.requestId ? ` • ${lastFailure.requestId}` : ''}`
    : runtimeData?.bootstrapped
      ? `DB ${runtimeData.db?.ok ? 'ok' : 'offline'}${runtimeData.db?.latencyMs != null ? ` • ${runtimeData.db.latencyMs}ms` : ''}${runtimeData.db?.error ? ` • ${runtimeData.db.error}` : ''}`
      : 'Sistema ainda não foi bootstrapado';

  const retryEnabled = Boolean(lastFailure?.retryable || runtimeData?.retryable || runtimeError);
  const retry = async () => {
    if (lastFailure?.retryable) {
      await retryLastFailure();
      return;
    }
    await runtime.refetch();
  };

  return (
    <div className="mx-8 mt-4 rounded-2xl border border-white/[0.08] bg-surface/70 backdrop-blur-md px-4 py-3 shadow-lg shadow-black/10">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${retryEnabled ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {isRetrying && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{details}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={retry}
              disabled={!retryEnabled || isRetrying}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => clearFailure()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-2"
            >
              <X className="h-3.5 w-3.5" />
              Fechar
            </button>
            {runtimeData?.retryAfterMs ? (
              <span className="text-[11px] text-muted-foreground">
                Nova tentativa sugerida em {Math.ceil(runtimeData.retryAfterMs / 1000)}s
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
