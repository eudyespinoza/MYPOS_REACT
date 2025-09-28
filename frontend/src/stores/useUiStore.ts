import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPosStorage } from './storage';

export type ThemeMode = 'light' | 'dark';

export type HotkeyAction =
  | 'help'
  | 'focusSearch'
  | 'toggleCart'
  | 'openDiscounts'
  | 'openLogistics'
  | 'openPayments'
  | 'openClients'
  | 'saveCart'
  | 'openSimulator';

export type HotkeyMap = Record<HotkeyAction, string>;

interface UiState {
  theme: ThemeMode;
  isCartOpen: boolean;
  isSimulatorOpen: boolean;
  isDiscountsOpen: boolean;
  isLogisticsOpen: boolean;
  isPaymentsOpen: boolean;
  isClientsPanelOpen: boolean;
  isHelpOpen: boolean;
  isOffline: boolean;
  syncingCart: boolean;
  hotkeys: HotkeyMap;
}

interface UiStore extends UiState {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setCartOpen: (open: boolean) => void;
  setSimulatorOpen: (open: boolean) => void;
  setDiscountsOpen: (open: boolean) => void;
  setLogisticsOpen: (open: boolean) => void;
  setPaymentsOpen: (open: boolean) => void;
  setClientsPanelOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setOffline: (offline: boolean) => void;
  setSyncingCart: (value: boolean) => void;
  setHotkey: (action: HotkeyAction, shortcut: string) => void;
  resetHotkeys: () => void;
}

const defaultHotkeys: HotkeyMap = {
  help: 'F1',
  focusSearch: 'Control+K',
  toggleCart: 'F2',
  openDiscounts: 'F7',
  openLogistics: 'F8',
  openPayments: 'Shift+F6',
  openClients: 'F9',
  saveCart: 'F10',
  openSimulator: 'F6',
};

const defaultState: UiState = {
  theme: 'dark',
  isCartOpen: false,
  isSimulatorOpen: false,
  isDiscountsOpen: false,
  isLogisticsOpen: false,
  isPaymentsOpen: false,
  isClientsPanelOpen: false,
  isHelpOpen: false,
  isOffline: false,
  syncingCart: false,
  hotkeys: defaultHotkeys,
};

export const useUiStore = create<UiStore>()(
  persist<UiStore, [], [], { theme: ThemeMode; hotkeys: HotkeyMap }>( 
    (set) => ({
      ...defaultState,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setCartOpen: (open) => set({ isCartOpen: open }),
      setSimulatorOpen: (open) => set({ isSimulatorOpen: open }),
      setDiscountsOpen: (open) => set({ isDiscountsOpen: open }),
      setLogisticsOpen: (open) => set({ isLogisticsOpen: open }),
      setPaymentsOpen: (open) => set({ isPaymentsOpen: open }),
      setClientsPanelOpen: (open) => set({ isClientsPanelOpen: open }),
      setHelpOpen: (open) => set({ isHelpOpen: open }),
      setOffline: (offline) => set({ isOffline: offline }),
      setSyncingCart: (value) => set({ syncingCart: value }),
      setHotkey: (action, shortcut) =>
        set((state) => ({ hotkeys: { ...state.hotkeys, [action]: shortcut } })),
      resetHotkeys: () => set({ hotkeys: defaultHotkeys }),
    }),
    {
      name: 'ui',
      storage: createPosStorage<{ theme: ThemeMode; hotkeys: HotkeyMap }>('ui', {
        onPersist: (state, root) => {
          root.tema = state.theme;
        },
        onHydrate: (value, root) => {
          const partial = (value as Partial<Pick<UiState, 'theme' | 'hotkeys'>>) ?? {};
          const themeFromRoot = typeof root.tema === 'string' ? (root.tema as ThemeMode) : undefined;
          return {
            theme: themeFromRoot ?? partial.theme ?? defaultState.theme,
            hotkeys: { ...defaultHotkeys, ...(partial.hotkeys ?? {}) },
          };
        },
      }),
      partialize: (state) => ({ theme: state.theme, hotkeys: state.hotkeys }),
      merge: (persistedState, currentState) => {
        if (!persistedState) return currentState;
        const persisted = persistedState as { state?: { theme?: ThemeMode; hotkeys?: HotkeyMap } };
        if (!persisted.state) return currentState;
        return {
          ...currentState,
          theme: persisted.state.theme ?? currentState.theme,
          hotkeys: { ...currentState.hotkeys, ...(persisted.state.hotkeys ?? {}) },
        };
      },
    },
  ),
);



