import { useState } from 'react';
import { login } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Loader2 } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.82 3.59-.85 1.56-.05 2.89.62 3.63 1.54-3.22 1.96-2.67 6.09.43 7.32-.73 1.76-1.78 3.35-2.73 4.16zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.36 2.4-1.92 4.47-3.74 4.25z"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
    <path fill="#f35325" d="M1.12 1.12h10.43v10.43H1.12z" />
    <path fill="#81bc06" d="M12.45 1.12h10.43v10.43H12.45z" />
    <path fill="#05a6f0" d="M1.12 12.45h10.43v10.43H1.12z" />
    <path fill="#ffba08" d="M12.45 12.45h10.43v10.43H12.45z" />
  </svg>
);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Immersive space-like background */}
      <div 
        className="absolute inset-0 z-0" 
        style={{
          background: 'radial-gradient(ellipse at bottom, #2b3b7a 0%, #151a30 100%)',
        }}
      >
        {/* Optional: Add some subtle stars or clouds effect here via CSS or pseudo-elements if desired, but for now a deep blue gradient serves the "Craft" look well. */}
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-8 py-10 rounded-[24px] bg-[#1a1c23] shadow-2xl border border-white/[0.04] text-center">
        {/* App Logo */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 p-0.5 shadow-lg">
          <div className="w-full h-full bg-[#1a1c23] rounded-[10px] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-white mt-4 mb-2">Bem-vindo ao AndClaw</h1>
        <p className="text-[13px] text-white/50 mb-8 max-w-[280px] mx-auto leading-relaxed">
          Confirme sua senha mestra para continuar ou <span className="underline cursor-pointer">continuar com SSO</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6">
          <input
            type="password"
            placeholder="Sua senha mestra"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#22252e] border border-white/[0.04] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-[#252833] transition-colors text-sm"
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg bg-[#2b6eb5] hover:bg-[#3482d4] text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Continuar
          </button>
        </form>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-[1px] flex-1 bg-white/[0.06]"></div>
          <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider">ou</span>
          <div className="h-[1px] flex-1 bg-white/[0.06]"></div>
        </div>

        <div className="flex flex-col gap-3 mb-8">
          <a
            href="/api/auth/google"
            className="w-full py-3 px-4 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.02] text-sm font-medium text-white/90 transition-colors"
          >
            <GoogleIcon />
            Continuar com Google
          </a>
          <button
            type="button"
            className="w-full py-3 px-4 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.02] text-sm font-medium text-white/90 transition-colors cursor-not-allowed opacity-60"
            title="Em breve"
          >
            <AppleIcon />
            Continuar com Apple
          </button>
          <button
            type="button"
            className="w-full py-3 px-4 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.02] text-sm font-medium text-white/90 transition-colors cursor-not-allowed opacity-60"
            title="Em breve"
          >
            <MicrosoftIcon />
            Continuar com Microsoft
          </button>
        </div>

        <div className="text-[11px] text-white/30 leading-relaxed">
          Ao clicar em continuar, você aceita nossos<br />
          <a href="#" className="underline hover:text-white/50 transition-colors">Termos e Condições</a> e <a href="#" className="underline hover:text-white/50 transition-colors">Política de Privacidade</a>
          <br /><br />
          Este site é protegido pelo reCAPTCHA e se aplicam os<br />
          <a href="#" className="underline hover:text-white/50 transition-colors">Termos e Condições</a> e a <a href="#" className="underline hover:text-white/50 transition-colors">Política de Privacidade</a> do Google
        </div>
      </div>
    </div>
  );
}
