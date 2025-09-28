import type { Client } from './client';

export type LineDiscountType = 'percent' | 'amount' | null;

export interface LineDiscount {
  type: LineDiscountType;
  value: number;
}

export interface CartLine {
  lineId: string;
  productId: string;
  code: string;
  name: string;
  price: number;
  iva: number;
  quantity: number;
  unit: string;
  multiple: number;
  weightKg: number;
  discount: LineDiscount | null;
  note?: string;
}

export type LogisticsMode = 'pickup' | 'delivery';

export interface LogisticsInfo {
  mode: LogisticsMode;
  storeId?: string;
  scheduledDate?: string;
  address?: string;
  cost: number;
  notes?: string;
}

export interface PaymentLine {
  id: string;
  method: string;
  amount: number;
  installments: number;
  interest: number;
  brand?: string;
  reference?: string;
}

export interface CartSnapshot {
  lines: CartLine[];
  client: Client | null;
  logistics: LogisticsInfo;
  globalDiscountPercent: number;
  globalDiscountAmount: number;
  note?: string;
  payments: PaymentLine[];
  simulatorTotals?: unknown;
  updatedAt?: string;
}

export interface CartTotals {
  subtotal: number;
  lineDiscounts: number;
  globalDiscounts: number;
  logisticsCost: number;
  tax: number;
  total: number;
  units: number;
  weightKg: number;
}
