import type { RefObject } from 'react';
import { useMemo } from 'react';
import { clsx } from 'clsx';
import { SearchBar } from './SearchBar';
import { BarcodeScannerButton } from './barcode/BarcodeScannerButton';
import type { ThemeMode } from '@/stores/useUiStore';

interface TopBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  onBarcodeScan: (code: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  stores: string[];
  currentStore: string | null;
  onStoreChange: (storeId: string) => void;
  isOnline: boolean;
  needsSync: boolean;
  isSyncing: boolean;
  lastSyncedAt?: string;
  onSaveCart: () => void;
  onOpenHelp: () => void;
}

export const TopBar = ({
  query,
  onQueryChange,
  onClearQuery,
  searchRef,
  onBarcodeScan,
  theme,
  onToggleTheme,
  stores,
  currentStore,
  onStoreChange,
  isOnline,
  needsSync,
  isSyncing,
  lastSyncedAt,
  onSaveCart,
  onOpenHelp,
}: TopBarProps) => {
  const syncStatus = useMemo(() => {
    if (!isOnline) return { label: 'Offline', tone: 'text-amber-300' };
    if (isSyncing) return { label: 'Sincronizando…', tone: 'text-primary-200' };
    if (needsSync) return { label: 'Cambios pendientes', tone: 'text-amber-200' };
    return {
      label: lastSyncedAt ? `Sync ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Sincronizado',
      tone: 'text-emerald-300',
    };
  }, [isOnline, isSyncing, needsSync, lastSyncedAt]);

  const actionButtonClasses = 'rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-primary-400 hover:text-primary-200';

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <div className="flex w-full max-w-xl items-center gap-2">
          <SearchBar ref={searchRef} value={query} onChange={onQueryChange} onClear={onClearQuery} />
          <BarcodeScannerButton onDetect={onBarcodeScan} />
        </div>
        <select
          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
          value={currentStore ?? ''}
          onChange={(event) => onStoreChange(event.target.value)}
        >
          <option value="">Sucursal</option>
          {stores.map((store) => (
            <option key={store} value={store}>
              {store}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <span className={clsx('flex items-center gap-2 rounded-full px-3 py-1', syncStatus.tone)}>
          <span className="inline-block h-2 w-2 rounded-full bg-current" />
          {syncStatus.label}
        </span>
        <button
          type="button"
          className={actionButtonClasses}
          onClick={onSaveCart}
        >
          Guardar carrito (F10)
        </button>
        <button
          type="button"
          className={actionButtonClasses}
          onClick={onOpenHelp}
        >
          Ayuda (F1)
        </button>
        <button
          type="button"
          className={actionButtonClasses}
          onClick={onToggleTheme}
        >
          Tema: {theme === 'dark' ? 'Oscuro' : 'Claro'}
        </button>
      </div>
    </header>
  );
};
