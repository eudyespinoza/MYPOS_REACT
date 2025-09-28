import { useEffect } from 'react';
import { clsx } from 'clsx';
import { useToastStore } from '@/stores/useToastStore';

const toneStyles: Record<string, string> = {
  info: 'border-sky-400/70 bg-slate-900/90 text-slate-100',
  success: 'border-emerald-400/70 bg-emerald-900/20 text-emerald-100',
  warning: 'border-amber-400/70 bg-amber-900/20 text-amber-100',
  error: 'border-red-400/70 bg-red-900/20 text-red-100',
};

export const ToastContainer = () => {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.ttl ?? 5000),
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, dismissToast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-3 p-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={clsx(
            'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur',
            toneStyles[toast.tone] ?? toneStyles.info,
          )}
        >
          <div className="flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs opacity-80">{toast.description}</p> : null}
          </div>
          <button
            type="button"
            className="mt-1 rounded-full p-1 text-xs text-current transition hover:bg-white/10"
            onClick={() => dismissToast(toast.id)}
          >
            Cerrar
          </button>
        </div>
      ))}
    </div>
  );
};
