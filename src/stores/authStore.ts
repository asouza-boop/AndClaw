import { create } from 'zustand';
import { getToken, clearToken } from '@/lib/api';

interface AuthState {
  isAuthenticated: boolean;
  checkAuth: () => void;
  logout: () => void;
  setAuthenticated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!getToken(),
  checkAuth: () => set({ isAuthenticated: !!getToken() }),
  logout: () => {
    clearToken();
    set({ isAuthenticated: false });
  },
  setAuthenticated: (v) => set({ isAuthenticated: v }),
}));
