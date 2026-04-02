const FALLBACK_API_BASE = 'https://andclaw.onrender.com';
const TOKEN_KEY = 'auth_token';

export const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, '');

  const origin = window.location.origin;
  const isVercelHost = origin.includes('vercel.app');
  if (!isVercelHost) return origin;

  return FALLBACK_API_BASE;
};

export const apiUrl = (path: string) => `${getApiBase()}${path}`;

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const apiFetch = async <T = unknown>(path: string, options?: RequestInit): Promise<T> => {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('Backend inicializando. Aguarde 30s e tente novamente.');
  }
  if (res.status === 401) {
    clearToken();
    throw new Error('Sessão expirada.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Erro ${res.status}`);
  }
  return res.json();
};

/** Safely coerce any API response into an array */
export const ensureArray = <T = any>(r: any): T[] =>
  Array.isArray(r) ? r : r?.items || r?.data || Object.values(r).find(Array.isArray) || [];

export const login = async (password: string) => {
  const data = await apiFetch<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setToken(data.token);
  return data;
};
