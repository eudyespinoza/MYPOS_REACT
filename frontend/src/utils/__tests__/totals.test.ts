import { describe, expect, it } from 'vitest';
import {
  calculateLineTotals,
  calculateCartTotals,
  deserializeCartSnapshot,
  type DeserializeCartSnapshotMeta,
} from '@/utils/totals';
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
    expect(totals.globalDiscounts).toBeCloseTo(100.2, 2);
    expect(totals.tax).toBeGreaterThan(0);
    expect(totals.logisticsCost).toBe(250);
    expect(totals.total).toBeGreaterThan(0);
  });
});

describe('deserializeCartSnapshot', () => {
  it('keeps modern snapshots without conversion', () => {
    const meta: DeserializeCartSnapshotMeta = {};
    const snapshot = deserializeCartSnapshot(
      {
        lines: [baseLine({ lineId: 'x' })],
        client: { id: 'c1', name: 'Cliente Actual' },
        logistics: { mode: 'delivery', cost: 50, address: 'Av. Siempre Viva 123' },
        globalDiscountPercent: 10,
        globalDiscountAmount: 20,
        payments: [],
      },
      meta,
    );
    expect(snapshot).not.toBeNull();
    expect(snapshot?.lines).toHaveLength(1);
    expect(snapshot?.client?.name).toBe('Cliente Actual');
    expect(snapshot?.logistics.mode).toBe('delivery');
    expect(snapshot?.globalDiscountPercent).toBe(10);
    expect(meta.converted).toBe(false);
  });

  it('converts legacy cart snapshots', () => {
    const meta: DeserializeCartSnapshotMeta = {};
    const snapshot = deserializeCartSnapshot(
      {
        items: [
          {
            id: 'SKU-LEG',
            nombre: 'Producto legado',
            precio: '150.5',
            iva: '21',
            cantidad: 2,
            unidad: 'Un',
            multiplo: 1,
          },
        ],
        descPorcentaje: '5',
        descMonto: '10',
        logistica: {
          tipo: 'envio',
          direccion: 'Calle Falsa 123',
          costo: '45.5',
          fecha: '2024-01-10',
          obs: 'Llamar antes',
        },
        cliente: {
          numero_cliente: '900',
          nombre_cliente: 'Cliente Legado',
          nif: '20-12345678-9',
          email: 'legacy@example.com',
          telefono: '555-0000',
          direccion_completa: 'Calle Falsa 123',
        },
      },
      meta,
    );
    expect(snapshot).not.toBeNull();
    const cart = snapshot!;
    expect(cart.lines).toHaveLength(1);
    const [line] = cart.lines;
    expect(line.productId).toBe('SKU-LEG');
    expect(line.quantity).toBeCloseTo(2);
    expect(line.price).toBeCloseTo(150.5);
    expect(cart.globalDiscountPercent).toBe(5);
    expect(cart.globalDiscountAmount).toBe(10);
    expect(cart.logistics.mode).toBe('delivery');
    expect(cart.logistics.address).toBe('Calle Falsa 123');
    expect(cart.logistics.cost).toBeCloseTo(45.5);
    expect(cart.client?.id).toBe('900');
    expect(cart.client?.name).toBe('Cliente Legado');
    expect(cart.client?.document).toBe('20-12345678-9');
    expect(meta.converted).toBe(true);
  });
});
