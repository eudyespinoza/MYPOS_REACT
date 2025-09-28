import { describe, expect, it } from 'vitest';
import { calculateLineTotals, calculateCartTotals } from '@/utils/totals';
import type { CartSnapshot, CartLine } from '@/types/cart';

const baseLine = (overrides: Partial<CartLine> = {}): CartLine => ({
  lineId: '1',
  productId: 'sku',
  code: 'SKU-001',
  name: 'Producto de prueba',
  price: 100,
  iva: 21,
  quantity: 1,
  unit: 'un',
  multiple: 1,
  weightKg: 0.5,
  discount: null,
  ...overrides,
});

describe('calculateLineTotals', () => {
  it('applies percent discount and IVA', () => {
    const totals = calculateLineTotals(baseLine({ quantity: 2, discount: { type: 'percent', value: 10 } }));
    expect(totals.gross).toBe(200);
    expect(totals.discount).toBe(20);
    expect(totals.net).toBe(180);
    expect(totals.tax).toBeCloseTo(37.8, 2);
    expect(totals.total).toBeCloseTo(217.8, 2);
  });

  it('caps amount discount to gross value', () => {
    const totals = calculateLineTotals(baseLine({ price: 50, quantity: 1, discount: { type: 'amount', value: 80 } }));
    expect(totals.gross).toBe(50);
    expect(totals.discount).toBe(50);
    expect(totals.net).toBe(0);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe('calculateCartTotals', () => {
  const cart: CartSnapshot = {
    lines: [
      baseLine({ lineId: 'a', quantity: 3, price: 120, discount: { type: 'percent', value: 5 } }),
      baseLine({ lineId: 'b', productId: 'sku-2', code: 'SKU-2', price: 80, quantity: 2, discount: null, iva: 10 }),
    ],
    client: null,
    logistics: { mode: 'pickup', cost: 250 },
    globalDiscountPercent: 10,
    globalDiscountAmount: 50,
    note: '',
    payments: [],
    simulatorTotals: undefined,
    updatedAt: new Date().toISOString(),
  };

  it('summarizes totals with discounts and logistics', () => {
    const totals = calculateCartTotals(cart);
    expect(totals.subtotal).toBe(520);
    expect(totals.lineDiscounts).toBeCloseTo(18, 2);
    expect(totals.globalDiscounts).toBeCloseTo(83, 2);
    expect(totals.tax).toBeGreaterThan(0);
    expect(totals.logisticsCost).toBe(250);
    expect(totals.total).toBeGreaterThan(0);
  });
});
