/**
 * Toast Store — simple Zustand store for notification toasts.
 */
import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  add: (message: string, variant?: ToastVariant) => void;
  remove: (id: string) => void;
}

let _counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  add: (message, variant = 'info') => {
    const id = `toast-${++_counter}-${Date.now()}`;
    const toast: Toast = { id, message, variant, createdAt: Date.now() };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    // Auto-dismiss after 6s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 6000);
  },

  remove: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Shorthand for error toasts from ApiError */
export function toastApiError(err: { code?: string; message?: string; requestId?: string | null; status?: number }) {
  const parts = [
    err.code || `HTTP_${err.status}`,
    err.message || 'Unknown error',
  ];
  if (err.requestId) parts.push(`(req: ${err.requestId})`);
  useToastStore.getState().add(parts.join(': '), 'error');
}
