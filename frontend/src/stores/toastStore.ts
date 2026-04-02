import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warn';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type, title, duration = 5000) => {
    const existing = get().toasts;
    if (existing.some((t) => t.message === message && t.type === type)) return;
    const id = crypto.randomUUID();
    set({ toasts: [...existing.slice(-2), { id, message, type, title }] });
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, type: ToastType, title?: string, duration?: number) =>
  useToastStore.getState().addToast(message, type, title, duration);
