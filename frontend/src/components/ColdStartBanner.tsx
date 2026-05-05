import { useState } from 'react';
import { useApiHealth } from '@/hooks/useApiHealth';
import { Zap, X, RefreshCw, Loader2 } from 'lucide-react';

export function ColdStartBanner() {
  const { isOnline, isChecking, retry } = useApiHealth();
  const [dismissed, setDismissed] = useState(false);

  if (isOnline || dismissed) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[95%] max-w-lg animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-xl p-4 shadow-2xl flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          {isChecking ? (
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          ) : (
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500/20" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-200">
            {isChecking ? 'Verificando conexão...' : 'O servidor está acordando...'}
          </p>
          <p className="text-xs text-amber-200/60 truncate">
            {isChecking ? 'Aguarde um momento.' : 'Isso pode levar até 60 segundos no Render Free Tier.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isChecking && (
            <button
              onClick={retry}
              className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-500 transition-colors"
              title="Verificar novamente"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-200/40 hover:text-amber-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
