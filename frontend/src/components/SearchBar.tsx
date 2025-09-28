import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface SearchBarProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, placeholder = 'Buscar productos (Ctrl+K)', onChange, onClear, onSubmit, disabled }, ref) => {
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'w-full rounded-lg border border-slate-700 bg-slate-900/70 py-2 pl-10 pr-14 text-sm text-slate-100 shadow-inner outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60',
          )}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSubmit) {
              event.preventDefault();
              onSubmit();
            }
            if (event.key === 'Escape' && onClear) {
              event.preventDefault();
              onClear();
            }
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M21 21l-4.35-4.35m1.35-4.65a6 6 0 11-12 0 6 6 0 0112 0z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="absolute inset-y-0 right-2 flex items-center gap-2">
          <kbd className="rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">Ctrl + K</kbd>
          {value && onClear ? (
            <button
              type="button"
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              onClick={onClear}
              aria-label="Limpiar búsqueda"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';
