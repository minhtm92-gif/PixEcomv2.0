'use client';

import { useToastStore, type ToastVariant } from '@/stores/toastStore';

const COLORS: Record<ToastVariant, string> = {
  info: 'bg-blue-600 border-blue-500',
  success: 'bg-green-600 border-green-500',
  error: 'bg-red-600 border-red-500',
  warning: 'bg-yellow-600 border-yellow-500',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${COLORS[t.variant]} border text-white text-sm px-4 py-3 rounded-lg shadow-lg cursor-pointer animate-slide-in`}
          onClick={() => remove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
