import { useBackendStore } from '@/stores/backendStore';

const FALLBACK_API_BASE = 'https://andclaw.onrender.com';
const TOKEN_KEY = 'auth_token';

export class ApiError extends Error {
  status?: number;
  retryable?: boolean;
  requestId?: string;
  code?: string;
  retryAfterMs?: number;

  constructor(message: string, init: Partial<ApiError> = {}) {
    super(message);
    this.name = 'ApiError';
    Object.assign(this, init);
  }
}

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
  const method = (options?.method || 'GET').toUpperCase();
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const requestId = res.headers.get('X-Request-Id') || undefined;
  const retryableHeader = res.headers.get('X-Retryable');
  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
  const registeredFailure = (error: ApiError, retry: () => Promise<unknown>) => {
    const retryable = error.retryable ?? false;
    if (!retryable) return;
    useBackendStore.getState().registerFailure({
      path,
      method,
      message: error.message,
      status: error.status,
      code: error.code,
      requestId: error.requestId,
      retryable,
      retryAfterMs: error.retryAfterMs,
      occurredAt: Date.now(),
      retry,
    });
  };

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const error = new ApiError('Backend inicializando. Aguarde 30s e tente novamente.', {
      status: res.status,
      retryable: res.status >= 500 || res.status === 409,
      requestId,
      retryAfterMs,
    });
    registeredFailure(error, () => apiFetch<T>(path, options));
    throw error;
  }
  if (res.status === 401) {
    clearToken();
    throw new ApiError('Sessão expirada.', { status: 401, retryable: false, requestId });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const retryable =
      typeof body.retryable === 'boolean'
        ? body.retryable
        : retryableHeader === 'true'
          ? true
          : res.status >= 500 || res.status === 409;
    const error = new ApiError(body.message || body.error || `Erro ${res.status}`, {
      status: res.status,
      retryable,
      requestId: body.requestId || requestId,
      code: body.error,
      retryAfterMs: body.retryAfterMs ?? retryAfterMs,
    });
    registeredFailure(error, () => apiFetch<T>(path, options));
    throw error;
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
