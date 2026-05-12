import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiBaseUrl, login } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import './LoginPage.css';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const getErrorMessage = (error: string | null) => {
  if (error === 'invalid_state') return 'Não foi possível validar esta tentativa de login. Tente novamente.';
  if (error === 'invalid_token') return 'Token de autenticação inválido. Tente novamente.';
  if (error === 'auth_failed') return 'Falha ao autenticar com Google. Tente novamente.';
  return null;
};

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const urlError = getErrorMessage(searchParams.get('error'));
  const errorMessage = formError || urlError;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      await login(password);
      setAuthenticated(true);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);
    window.location.href = `${getApiBaseUrl()}/api/auth/google?state=${encodeURIComponent(state)}`;
  };

  return (
    <main className="andclaw-login-page">
      <section
        aria-label="Login"
        style={{
          width: '440px',
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-med)',
          borderRadius: '20px',
          padding: '48px 40px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            margin: '0 auto 24px',
            borderRadius: '12px',
            background: 'var(--color-accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'var(--font-semibold)',
          }}
        >
          AC
        </div>

        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--color-text-primary)',
            textAlign: 'center',
            marginBottom: '8px',
          }}
        >
          Bem-vindo ao AndClaw
        </h1>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          Entre com sua conta para continuar
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Senha de acesso"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-label="Senha de acesso"
            style={{
              width: '100%',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              padding: '0 14px',
              marginBottom: '12px',
              outline: 'none',
              transition: 'border-color var(--t-fast)',
            }}
            onFocus={(event) => {
              event.currentTarget.style.borderColor = 'var(--color-accent)';
            }}
            onBlur={(event) => {
              event.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          />
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              height: '44px',
              background: loading || !password ? 'var(--color-accent-dim)' : 'var(--color-accent)',
              color: '#fff',
              fontWeight: 'var(--font-medium)',
              fontSize: 'var(--text-base)',
              borderRadius: 'var(--radius-md)',
              border: 0,
              marginBottom: '24px',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'background var(--t-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(event) => {
              if (!loading && password) event.currentTarget.style.background = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(event) => {
              if (!loading && password) event.currentTarget.style.background = 'var(--color-accent)';
            }}
          >
            {loading ? <Spinner size="sm" /> : null}
            Entrar
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ height: '1px', flex: 1, background: 'var(--color-border)' }} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>ou</span>
          <div style={{ height: '1px', flex: 1, background: 'var(--color-border)' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            height: '44px',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-med)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'background var(--t-fast), border-color var(--t-fast)',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--color-bg-overlay)';
            event.currentTarget.style.borderColor = 'var(--color-border-strong)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'var(--color-bg-elevated)';
            event.currentTarget.style.borderColor = 'var(--color-border-med)';
          }}
        >
          <GoogleIcon />
          Continuar com Google
        </button>

        {errorMessage ? (
          <div
            role="alert"
            style={{
              marginTop: '16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-error)',
            }}
          >
            {errorMessage}
          </div>
        ) : null}
      </section>
    </main>
  );
}
