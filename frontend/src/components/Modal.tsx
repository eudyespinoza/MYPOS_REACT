import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
}

export const Modal = ({ open, onClose, title, size = 'md', children }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  const container = document.getElementById('modal-root') ?? document.body;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'w-full max-h-full overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-2xl',
          sizeMap[size],
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="text-sm font-semibold text-slate-200">{title}</div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    container,
  );
};
