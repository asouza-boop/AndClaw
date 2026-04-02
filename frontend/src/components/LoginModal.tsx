import { useState } from 'react';
import { login } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Lock, Loader2 } from 'lucide-react';

export function LoginModal() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(password);
      setAuthenticated(true);
      toast('Login realizado com sucesso', 'success');
    } catch (err: any) {
      toast(err.message || 'Erro ao fazer login', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm p-8 rounded-xl bg-surface glow-border">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">AndClaw</h1>
          <p className="text-sm text-muted-foreground">AI Command Center</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-md bg-surface-2 border border-white/[0.07] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-md bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
