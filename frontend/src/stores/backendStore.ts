import { create } from 'zustand';

export type BackendFailure = {
  path: string;
  method: string;
  message: string;
  status?: number;
  code?: string;
  requestId?: string;
  retryable: boolean;
  retryAfterMs?: number;
  occurredAt: number;
  retry: () => Promise<unknown>;
};

type BackendStore = {
  lastFailure: BackendFailure | null;
  isRetrying: boolean;
  registerFailure: (failure: BackendFailure) => void;
  clearFailure: () => void;
  retryLastFailure: () => Promise<void>;
  setRetrying: (value: boolean) => void;
};

export const useBackendStore = create<BackendStore>((set, get) => ({
  lastFailure: null,
  isRetrying: false,
  registerFailure: (failure) => set({ lastFailure: failure }),
  clearFailure: () => set({ lastFailure: null }),
  setRetrying: (value) => set({ isRetrying: value }),
  retryLastFailure: async () => {
    const failure = get().lastFailure;
    if (!failure || !failure.retryable) return;
    set({ isRetrying: true });
    try {
      await failure.retry();
      set({ lastFailure: null });
    } finally {
      set({ isRetrying: false });
    }
  },
}));

