import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  useEffect(() => {
    const token = searchParams.get('token');
    const urlState = searchParams.get('state');
    const savedState = sessionStorage.getItem('oauth_state');
    if (!urlState || urlState !== savedState) {
      navigate('/login?error=invalid_state', { replace: true });
      return;
    }
    sessionStorage.removeItem('oauth_state');

    if (token) {
      localStorage.setItem('auth_token', token);
      setAuthenticated(true);
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login?error=invalid_token', { replace: true });
    }
  }, [searchParams, navigate, setAuthenticated]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Autenticando...</p>
      </div>
    </div>
  );
}
