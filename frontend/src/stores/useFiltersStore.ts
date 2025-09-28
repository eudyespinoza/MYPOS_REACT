import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPosStorage } from './storage';

export type SortOption =
  | 'relevance'
  | 'priceAsc'
  | 'priceDesc'
  | 'nameAsc'
  | 'nameDesc'
  | 'stockDesc';

interface StockFilters {
  positive: boolean;
  zero: boolean;
  negative: boolean;
}

interface FiltersState {
  query: string;
  category: string;
  coverageGroup: string;
  storeId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  stock: StockFilters;
  sort: SortOption;
  page: number;
  perPage: number;
}

interface FiltersStore extends FiltersState {
  setQuery: (value: string) => void;
  setCategory: (value: string) => void;
  setCoverageGroup: (value: string) => void;
  setStoreId: (value: string | null) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setStockFilter: (key: keyof StockFilters, value: boolean) => void;
  setSort: (value: SortOption) => void;
  setPage: (value: number) => void;
  setPerPage: (value: number) => void;
  resetFilters: () => void;
}

const defaultState: FiltersState = {
  query: '',
  category: '',
  coverageGroup: '',
  storeId: null,
  minPrice: null,
  maxPrice: null,
  stock: {
    positive: true,
    zero: true,
    negative: false,
  },
  sort: 'relevance',
  page: 1,
  perPage: 20,
};

export const useFiltersStore = create<FiltersStore>()(
  persist<FiltersStore, [], [], FiltersState>( 
    (set, get) => ({
      ...defaultState,
      setQuery: (value) => set({ query: value.trim(), page: 1 }),
      setCategory: (value) => set({ category: value, page: 1 }),
      setCoverageGroup: (value) => set({ coverageGroup: value, page: 1 }),
      setStoreId: (value) => set({ storeId: value, page: 1 }),
      setPriceRange: (min, max) => set({ minPrice: min, maxPrice: max, page: 1 }),
      setStockFilter: (key, value) =>
        set((state) => ({ stock: { ...state.stock, [key]: value }, page: 1 })),
      setSort: (value) => set({ sort: value, page: 1 }),
      setPage: (value) => set({ page: Math.max(1, value) }),
      setPerPage: (value) => set({ perPage: Math.max(1, value), page: 1 }),
      resetFilters: () => set({ ...defaultState, storeId: get().storeId ?? null }),
    }),
    {
      name: 'filtros',
      partialize: (state) => ({
        query: state.query,
        category: state.category,
        coverageGroup: state.coverageGroup,
        storeId: state.storeId,
        minPrice: state.minPrice,
        maxPrice: state.maxPrice,
        stock: state.stock,
        sort: state.sort,
        page: state.page,
        perPage: state.perPage,
      }),
      storage: createPosStorage<FiltersState>('filtros', {
        onPersist: (state, root) => {
          root.currentPage = state.page;
          root.itemsPerPage = state.perPage;
        },
        onHydrate: (value, root) => {
          const partial = (value as Partial<FiltersState>) ?? {};
          const page = typeof root.currentPage === 'number' ? root.currentPage : partial.page ?? defaultState.page;
          const perPage = typeof root.itemsPerPage === 'number' ? root.itemsPerPage : partial.perPage ?? defaultState.perPage;
          return {
            ...defaultState,
            ...partial,
            page,
            perPage,
          } satisfies FiltersState;
        },
      }),
      merge: (persistedState, currentState) => {
        if (!persistedState) return currentState;
        const persisted = persistedState as { state?: FiltersState };
        if (!persisted.state) return currentState;
        return {
          ...currentState,
          ...persisted.state,
        };
      },
    },
  ),
);

