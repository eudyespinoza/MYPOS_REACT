import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  createdAt: number;
  ttl?: number;
}

interface ToastStoreState {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id' | 'createdAt'> & { id?: string }) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_TTL = 5000;

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  pushToast: ({ id, ttl, ...rest }) =>
    set((state) => {
      const toastId = id ?? crypto.randomUUID();
      const next: ToastItem = {
        id: toastId,
        title: rest.title,
        description: rest.description,
        tone: rest.tone,
        createdAt: Date.now(),
        ttl: ttl ?? DEFAULT_TTL,
      };
      return { toasts: [...state.toasts.filter((toast) => toast.id !== toastId), next].slice(-5) };
    }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));
