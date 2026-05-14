import { FormEvent, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiBaseUrl, login } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import './LoginPage.css';

/* ─── Google Icon ────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="currentColor" opacity="0.6" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
  </svg>
);

/* ─── Lock Icon ──────────────────────────────────────────────── */
const LockIcon = () => (
  <svg className="login-input-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
  </svg>
);

/* ─── Animated Bot Mascot (SVG) ──────────────────────────────── */
const BotMascot = () => {
  const eyesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const eyes = eyesRef.current;
      if (!eyes) return;
      const rect = eyes.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const distance = Math.min(3, Math.hypot(e.clientX - centerX, e.clientY - centerY) / 50);
      eyes.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="login-bot-container">
      <div className="login-bot-glow" />
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="botGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="100%" stopColor="#ef4444" />
          </radialGradient>
          <filter id="eyeGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Antenas */}
        <path className="login-antenna-wave" d="M35,25 Q30,10 22,15" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
        <path className="login-antenna-wave" style={{ animationDelay: '0.5s' }} d="M65,25 Q70,10 78,15" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />

        {/* Corpo */}
        <circle cx="50" cy="55" r="38" fill="url(#botGrad)" />
        <path d="M50,17 A38,38 0 0,1 88,55 A38,38 0 0,1 50,93" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="4" />

        {/* Braços */}
        <circle cx="12" cy="55" r="11" fill="#ef4444" />
        <circle cx="88" cy="55" r="11" fill="#ef4444" />

        {/* Olhos — eye tracking */}
        <g ref={eyesRef}>
          <circle cx="38" cy="48" r="6" fill="#1e1b4b" />
          <circle cx="38" cy="48" r="2.5" fill="#22d3ee" className="login-eye-blink" filter="url(#eyeGlow)" />
          <circle cx="62" cy="48" r="6" fill="#1e1b4b" />
          <circle cx="62" cy="48" r="2.5" fill="#22d3ee" className="login-eye-blink" filter="url(#eyeGlow)" />
        </g>

        {/* Pernas */}
        <rect x="37" y="88" width="9" height="12" rx="4.5" fill="#ef4444" />
        <rect x="54" y="88" width="9" height="12" rx="4.5" fill="#ef4444" />
      </svg>
    </div>
  );
};

/* ─── Star Field Background ──────────────────────────────────── */
const StarField = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.childNodes.length > 0) return;
    for (let i = 0; i < 200; i++) {
      const star = document.createElement('div');
      star.className = 'login-star';
      const size = Math.random() * 1.5 + 0.5;
      star.style.width = star.style.height = `${size}px`;
      star.style.left = `${Math.random() * 100}vw`;
      star.style.top = `${Math.random() * 100}vh`;
      star.style.animationDelay = `${Math.random() * 8}s`;
      star.style.backgroundColor = Math.random() > 0.8 ? '#a5b4fc' : '#ffffff';
      if (size > 1.2) star.style.boxShadow = `0 0 ${size * 4}px white`;
      container.appendChild(star);
    }
  }, []);

  return <div ref={containerRef} className="login-stars-container" />;
};

/* ─── Error Messages ─────────────────────────────────────────── */
const getErrorMessage = (error: string | null) => {
  if (error === 'invalid_state') return 'Não foi possível validar esta tentativa de login. Tente novamente.';
  if (error === 'invalid_token') return 'Token de autenticação inválido. Tente novamente.';
  if (error === 'auth_failed') return "O servidor estava iniciando durante o login. Clique em 'Identity Cluster' novamente para tentar.";
  return null;
};

const createOAuthState = () => {
  const payload = JSON.stringify({ returnTo: window.location.origin });
  return `${crypto.randomUUID()}.${btoa(payload)}`;
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOGIN PAGE — All auth logic preserved identically
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const urlError = getErrorMessage(searchParams.get('error'));
  const errorMessage = formError || googleError || urlError;

  /* Password login */
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
  }, [password, navigate, setAuthenticated]);

  /* Google OAuth */
  const handleGoogleLogin = useCallback(async () => {
    setGoogleLoading(true);
    setGoogleError(null);

    try {
      const apiBase = getApiBaseUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      try {
        await fetch(apiBase + '/api/health', {
          signal: controller.signal,
          mode: 'cors',
        });
      } catch {
        // Backend might still handle the OAuth redirect
      } finally {
        clearTimeout(timeout);
      }

      const state = createOAuthState();
      sessionStorage.setItem('oauth_state', state);
      window.location.href = `${apiBase}/api/auth/google?state=${encodeURIComponent(state)}`;
    } catch {
      setGoogleLoading(false);
      setGoogleError('Erro ao conectar. Tente novamente.');
    }
  }, []);

  return (
    <main className="andclaw-login-page">
      {/* Background layers */}
      <StarField />
      <div className="login-halftone" />

      {/* Card */}
      <div className="login-card">
        <div className="login-scan-line" />

        {/* Bot Mascot */}
        <BotMascot />

        {/* Title */}
        <div className="login-title-area">
          <h1 className="login-title">
            ANDCLAW <span className="login-title-accent">OS</span>
          </h1>
          <div className="login-secure-badge">
            <div className="login-secure-line login-secure-line-left" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="login-secure-dot" />
              <span className="login-secure-text">Sessão Segura</span>
            </div>
            <div className="login-secure-line login-secure-line-right" />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-wrapper">
            <label htmlFor="login-password">Chave de Encriptação</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type="password"
                placeholder="Introduza o código"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Chave de encriptação"
                className="login-input-field"
                autoComplete="current-password"
              />
              <LockIcon />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="login-btn-main"
          >
            {loading ? <Spinner size="sm" /> : null}
            Iniciar Sincronização
          </button>
        </form>

        {/* Divider */}
        <div style={{ marginTop: '24px', marginBottom: '24px' }}>
          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-label">Gateway Externo</span>
          </div>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="login-btn-google"
        >
          {googleLoading ? <Spinner size="sm" /> : <GoogleIcon />}
          {googleLoading ? 'Conectando...' : 'Identity Cluster'}
        </button>

        {/* Cold-start message */}
        {googleLoading && (
          <p className="login-cold-start">
            Acordando o servidor, aguarde até 30s...
          </p>
        )}

        {/* Error display */}
        {errorMessage && (
          <div role="alert" className="login-error-alert">
            {errorMessage}
          </div>
        )}

        {/* Footer link */}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <button type="button" className="login-footer-link" tabIndex={-1}>
            Recuperar Frequência de Acesso
          </button>
        </div>
      </div>
    </main>
  );
}
