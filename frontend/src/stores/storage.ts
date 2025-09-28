import type { PersistStorage } from 'zustand/middleware';

const ROOT_KEY = 'pos.front.state';

const supportsStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readRoot = (): Record<string, unknown> => {
  if (!supportsStorage) return {};
  const value = window.localStorage.getItem(ROOT_KEY);
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch (error) {
    console.warn('Failed to parse persisted POS state', error);
    return {};
  }
};

const writeRoot = (data: Record<string, unknown>) => {
  if (!supportsStorage) return;
  try {
    window.localStorage.setItem(ROOT_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to persist POS state', error);
  }
};

interface StorageAdapter<T = unknown> {
  onPersist?: (value: T, root: Record<string, unknown>) => void;
  onHydrate?: (value: unknown, root: Record<string, unknown>) => T;
}

export const createPosStorage = <State = unknown>(
  segment: string,
  adapter?: StorageAdapter<State>,
): PersistStorage<State> => ({
  getItem: () => {
    if (!supportsStorage) return null;
    const root = readRoot();
    if (!(segment in root)) return null;
    const raw = root[segment];
    const state = adapter?.onHydrate ? adapter.onHydrate(raw, root) : (raw as State);
    return { state, version: 0 };
  },
  setItem: (_name, value) => {
    if (!supportsStorage) return;
    const root = readRoot();
    root[segment] = value.state as unknown;
    adapter?.onPersist?.(value.state as State, root);
    writeRoot(root);
  },
  removeItem: () => {
    if (!supportsStorage) return;
    const root = readRoot();
    if (segment in root) {
      delete root[segment];
      writeRoot(root);
    }
  },
});

export const clearPosStorage = () => {
  if (!supportsStorage) return;
  window.localStorage.removeItem(ROOT_KEY);
};
