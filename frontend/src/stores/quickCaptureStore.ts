import { create } from 'zustand';

interface QuickCaptureState {
  isOpen: boolean;
  type: 'note' | 'task' | 'idea' | 'link';
  open: (type?: 'note' | 'task' | 'idea' | 'link') => void;
  close: () => void;
  toggle: () => void;
}

export const useQuickCaptureStore = create<QuickCaptureState>((set) => ({
  isOpen: false,
  type: 'note',
  open: (type = 'note') => set({ isOpen: true, type }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
