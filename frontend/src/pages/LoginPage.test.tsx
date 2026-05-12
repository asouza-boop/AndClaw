import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const loginMock = vi.fn();

vi.mock('@/lib/api', () => ({
  getApiBaseUrl: () => 'https://api.example',
  getToken: () => localStorage.getItem('auth_token'),
  clearToken: () => localStorage.removeItem('auth_token'),
  login: (...args: unknown[]) => loginMock(...args),
}));

const renderLogin = (initialEntry = '/login') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('LoginPage', () => {
  const originalLocation = window.location;
  const originalRandomUUID = crypto.randomUUID;

  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockResolvedValue({ token: 'token-123' });
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => 'state-123',
    });
    delete (window as unknown as { location?: Location }).location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'http://localhost:5173/login' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: originalRandomUUID,
    });
  });

  it('renders the AndClaw welcome heading', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Bem-vindo ao AndClaw' })).toBeInTheDocument();
  });

  it('submits the password form through the auth API', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('Senha de acesso'), { target: { value: 'secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('secret-123'));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('starts Google OAuth with an origin-scoped state value', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    expect(sessionStorage.getItem('oauth_state')).toBe('state-123');
    expect(window.location.href).toBe('https://api.example/api/auth/google?state=state-123');
  });

  it('renders an error message from the URL parameter', () => {
    renderLogin('/login?error=auth_failed');

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao autenticar com Google. Tente novamente.');
  });
});
