import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      sessionStorage.setItem('post_auth_redirect', '/dashboard');
      setErrorState('auth_failed');
      return;
    }

    const token = searchParams.get('token');
    const urlState = searchParams.get('state');
    const savedState = sessionStorage.getItem('oauth_state');
    
    if (!urlState || urlState !== savedState) {
      sessionStorage.setItem('post_auth_redirect', '/dashboard');
      setErrorState('invalid_state');
      return;
    }
    sessionStorage.removeItem('oauth_state');

    if (token) {
      localStorage.setItem('auth_token', token);
      setAuthenticated(true);
      navigate('/dashboard', { replace: true });
    } else {
      sessionStorage.setItem('post_auth_redirect', '/dashboard');
      setErrorState('invalid_token');
    }
  }, [searchParams, navigate, setAuthenticated]);

  if (errorState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#111318] text-white">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-[#1A1D24] border border-white/[0.04]">
          <h1 className="text-xl font-semibold text-red-400">Falha no login</h1>
          <p className="text-sm text-white/60 text-center max-w-[280px]">
            O servidor estava iniciando. Tente novamente.
          </p>
          <button
            onClick={() => navigate('/login?error=auth_failed')}
            className="mt-4 px-6 py-2.5 bg-[#2b6eb5] hover:bg-[#3482d4] rounded-lg text-sm font-medium transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#111318] text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
        <p className="text-sm text-white/50">Autenticando...</p>
      </div>
    </div>
  );
}
