import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartSnapshot, CartTotals, CartLine, LineDiscount, LogisticsInfo, PaymentLine } from '@/types/cart';
import type { Product } from '@/types/product';
import type { Client } from '@/types/client';
import {
  calculateCartTotals,
  deserializeCartSnapshot,
  type DeserializeCartSnapshotMeta,
} from '@/utils/totals';
import { clamp } from '@/utils/number';
import { createPosStorage } from './storage';

const nowIso = () => new Date().toISOString();

const createEmptyCart = (): CartSnapshot => ({
  lines: [],
  client: null,
  logistics: {
    mode: 'pickup',
    cost: 0,
    notes: undefined,
  },
  globalDiscountPercent: 0,
  globalDiscountAmount: 0,
  note: '',
  payments: [],
  simulatorTotals: undefined,
  updatedAt: nowIso(),
});

const ensureMultiple = (quantity: number, multiple: number): number => {
  if (multiple <= 0) return quantity;
  const steps = Math.round(quantity / multiple);
  const result = steps * multiple;
  return result <= 0 ? multiple : Number(result.toFixed(4));
};

interface CartStoreState {
  cart: CartSnapshot;
  totals: CartTotals;
  needsSync: boolean;
  isSyncing: boolean;
  lastSyncedAt?: string;
  remoteError?: string | null;
  addProduct: (product: Product, quantity?: number, discount?: LineDiscount | null) => void;
  addQuickLine: (line: CartLine) => void;
  removeLine: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  bumpQuantity: (lineId: string, delta: number) => void;
  setLineDiscount: (lineId: string, discount: LineDiscount | null) => void;
  setGlobalDiscounts: (percent: number, amount: number) => void;
  setLogistics: (logistics: Partial<LogisticsInfo>) => void;
  setClient: (client: Client | null) => void;
  setNote: (note: string) => void;
  setPayments: (payments: PaymentLine[]) => void;
  setSimulatorTotals: (payload: unknown) => void;
  markSynced: () => void;
  setSyncing: (value: boolean) => void;
  setRemoteError: (message: string | null) => void;
  resetCart: () => void;
  hydrateRemoteCart: (snapshot: unknown) => void;
}

const recalc = (cart: CartSnapshot) => ({
  cart,
  totals: calculateCartTotals(cart),
});

export const useCartStore = create<CartStoreState>()(
  persist<CartStoreState, [], [], { cart: CartSnapshot }>( 
    (set, get) => ({
      cart: createEmptyCart(),
      totals: calculateCartTotals(createEmptyCart()),
      needsSync: false,
      isSyncing: false,
      lastSyncedAt: undefined,
      remoteError: null,
      addProduct: (product, incomingQty = 1, discount = null) => {
        set((state) => {
          const quantity = Math.max(0.0001, incomingQty);
          const multiple = product.multiple > 0 ? product.multiple : 1;
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            lines: (() => {
              const existing = state.cart.lines.find((line) => line.productId === product.id);
              if (existing) {
                const newQuantity = ensureMultiple(existing.quantity + quantity, multiple);
                return state.cart.lines.map((line) =>
                  line.lineId === existing.lineId
                    ? {
                        ...line,
                        quantity: newQuantity,
                        discount: discount ?? line.discount,
                      }
                    : line,
                );
              }
              const line: CartLine = {
                lineId: crypto.randomUUID(),
                productId: product.id,
                code: product.code,
                name: product.name,
                price: product.price,
                iva: product.iva,
                quantity: ensureMultiple(quantity, multiple),
                unit: product.unit,
                multiple,
                weightKg: product.weightKg,
                discount: discount,
              };
              return [...state.cart.lines, line];
            })(),
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      addQuickLine: (line) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            lines: [...state.cart.lines, line],
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      removeLine: (lineId) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            lines: state.cart.lines.filter((line) => line.lineId !== lineId),
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      updateQuantity: (lineId, quantity) => {
        set((state) => {
          const target = state.cart.lines.find((line) => line.lineId === lineId);
          if (!target) return state;
          const multiple = target.multiple > 0 ? target.multiple : 1;
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            lines: state.cart.lines.map((line) =>
              line.lineId === lineId
                ? {
                    ...line,
                    quantity: ensureMultiple(Math.max(quantity, multiple), multiple),
                  }
                : line,
            ),
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      bumpQuantity: (lineId, delta) => {
        const { cart } = get();
        const target = cart.lines.find((line) => line.lineId === lineId);
        if (!target) return;
        const newQty = Math.max(target.multiple, target.quantity + delta);
        get().updateQuantity(lineId, newQty);
      },
      setLineDiscount: (lineId, discount) => {
        set((state) => {
          const target = state.cart.lines.find((line) => line.lineId === lineId);
          if (!target) return state;
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            lines: state.cart.lines.map((line) =>
              line.lineId === lineId
                ? {
                    ...line,
                    discount: discount
                      ? {
                          type: discount.type,
                          value: clamp(discount.value, 0, discount.type === 'percent' ? 100 : Number.MAX_SAFE_INTEGER),
                        }
                      : null,
                  }
                : line,
            ),
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      setGlobalDiscounts: (percent, amount) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            globalDiscountPercent: clamp(percent, 0, 100),
            globalDiscountAmount: Math.max(0, amount),
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      setLogistics: (logistics) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            logistics: {
              ...state.cart.logistics,
              ...logistics,
              mode: logistics.mode ?? state.cart.logistics.mode ?? 'pickup',
              cost: logistics.cost != null ? Math.max(0, logistics.cost) : state.cart.logistics.cost,
            },
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      setClient: (client) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            client,
          };
          return {
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      setNote: (note) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            note,
          };
          return {
            ...state,
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      setPayments: (payments) => {
        set((state) => {
          const cart: CartSnapshot = {
            ...state.cart,
            updatedAt: nowIso(),
            payments,
          };
          return {
            ...state,
            ...recalc(cart),
            needsSync: true,
            remoteError: null,
          };
        });
      },
      setSimulatorTotals: (payload) => {
        set((state) => ({
          cart: {
            ...state.cart,
            updatedAt: nowIso(),
            simulatorTotals: payload,
          },
          totals: state.totals,
          needsSync: true,
          remoteError: null,
        }));
      },
      markSynced: () => {
        set(() => ({
          needsSync: false,
          isSyncing: false,
          lastSyncedAt: nowIso(),
          remoteError: null,
        }));
      },
      setSyncing: (value) => set(() => ({ isSyncing: value })),
      setRemoteError: (message) => set(() => ({ remoteError: message })),
      resetCart: () => {
        const fresh = createEmptyCart();
        set({
          cart: fresh,
          totals: calculateCartTotals(fresh),
          needsSync: true,
          remoteError: null,
        });
      },
      hydrateRemoteCart: (snapshot) => {
        const meta: DeserializeCartSnapshotMeta = {};
        const parsed = deserializeCartSnapshot(snapshot, meta);
        if (!parsed) return;
        set(() => ({
          cart: {
            ...parsed,
            updatedAt: nowIso(),
          },
          totals: calculateCartTotals(parsed),
          needsSync: Boolean(meta.converted),
          remoteError: null,
          lastSyncedAt: nowIso(),
        }));
      },
    }),
    {
      name: 'carrito',
      storage: createPosStorage<{ cart: CartSnapshot }>('carrito'),
      partialize: (state) => ({ cart: state.cart }),
      merge: (persistedState, currentState) => {
        if (!persistedState) return currentState;
        const persisted = persistedState as { cart?: unknown } | null;
        const snapshotSource = persisted?.cart ?? currentState.cart;
        const meta: DeserializeCartSnapshotMeta = {};
        const snapshot = deserializeCartSnapshot(snapshotSource, meta) ?? currentState.cart;
        return {
          ...currentState,
          cart: snapshot,
          totals: calculateCartTotals(snapshot),
          needsSync: currentState.needsSync || Boolean(meta.converted),
        };
      },
    },
  ),
);




