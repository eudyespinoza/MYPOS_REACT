import { create } from 'zustand';

interface SessionState {
  userEmail: string | null;
  userName: string | null;
  stores: string[];
  isAuthenticated: boolean;
  setUser: (payload: { email?: string | null; name?: string | null }) => void;
  setStores: (stores: string[]) => void;
  reset: () => void;
}

const defaultState = {
  userEmail: null,
  userName: null,
  stores: [] as string[],
  isAuthenticated: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...defaultState,
  setUser: ({ email, name }) =>
    set(() => ({
      userEmail: email ?? null,
      userName: name ?? null,
      isAuthenticated: Boolean(email),
    })),
  setStores: (stores) => set(() => ({ stores })),
  reset: () => set(() => ({ ...defaultState })),
}));
