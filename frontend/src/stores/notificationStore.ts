import { create } from 'zustand';
import { apiFetch, ensureArray } from '@/lib/api';

export interface Notification {
  id: string;
  type: 'message' | 'alert' | 'task' | 'meeting' | 'agent';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  fetchNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set((s) => ({ open: !s.open })),

  markRead: (id) =>
    set((s) => {
      const items = s.items.map((n) => (n.id === id ? { ...n, read: true } : n));
      const unreadCount = items.filter((n) => !n.read).length;
      try { navigator.setAppBadge?.(unreadCount); } catch {}
      return { items, unreadCount };
    }),

  markAllRead: () =>
    set((s) => {
      try { navigator.clearAppBadge?.(); } catch {}
      return {
        items: s.items.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    }),

  addNotification: (n) =>
    set((s) => {
      const item: Notification = {
        ...n,
        id: crypto.randomUUID(),
        read: false,
        createdAt: new Date().toISOString(),
      };
      const items = [item, ...s.items].slice(0, 50);
      const unreadCount = items.filter((i) => !i.read).length;
      try { navigator.setAppBadge?.(unreadCount); } catch {}
      return { items, unreadCount };
    }),

  fetchNotifications: async () => {
    try {
      const data = await apiFetch<any>('/api/notifications').then(ensureArray);
      const items = data.map((n: any) => ({
        id: n._id || n.id || crypto.randomUUID(),
        type: n.type || 'alert',
        title: n.title || '',
        body: n.body || n.message || '',
        read: !!n.read,
        createdAt: n.createdAt || n.created_at || new Date().toISOString(),
        link: n.link,
      }));
      const unreadCount = items.filter((n: Notification) => !n.read).length;
      try { 
        if (unreadCount > 0) {
          navigator.setAppBadge?.(unreadCount); 
        } else {
          navigator.clearAppBadge?.();
        }
      } catch {}
      set({ items, unreadCount });
    } catch {
      // API may not exist yet — keep empty
    }
  },
}));
