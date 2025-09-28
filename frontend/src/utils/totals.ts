import type { CartLine, CartSnapshot, CartTotals } from '@/types/cart';
import { clamp, round, toNumber } from './number';

export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
}

export const calculateLineTotals = (line: CartLine): LineTotals => {
  const gross = round(line.price * line.quantity);
  const discountValue = line.discount?.value ?? 0;
  let discount = 0;
  if (line.discount?.type === 'percent') {
    discount = round(gross * (clamp(discountValue, 0, 100) / 100));
  } else if (line.discount?.type === 'amount') {
    discount = round(Math.min(Math.max(discountValue, 0), gross));
  }
  const net = Math.max(0, round(gross - discount));
  const tax = round(net * (line.iva / 100));
  const total = round(net + tax);
  return { gross, discount, net, tax, total };
};

const calculateGlobalDiscount = (
  base: number,
  percent: number,
  amount: number,
): { percentAmount: number; manualAmount: number; total: number } => {
  const safePercent = clamp(percent, 0, 100);
  const percentAmount = safePercent > 0 ? round(base * (safePercent / 100)) : 0;
  const maxAmount = Math.max(0, base - percentAmount);
  const manualAmount = amount > 0 ? round(Math.min(amount, maxAmount)) : 0;
  const total = round(percentAmount + manualAmount);
  return { percentAmount, manualAmount, total };
};

export const calculateCartTotals = (cart: CartSnapshot): CartTotals => {
  const lineSummaries = cart.lines.map((line) => calculateLineTotals(line));
  const subtotal = round(lineSummaries.reduce((acc, summary) => acc + summary.gross, 0));
  const lineDiscounts = round(lineSummaries.reduce((acc, summary) => acc + summary.discount, 0));
  const netAfterLineDiscounts = Math.max(0, subtotal - lineDiscounts);
  const { total: globalDiscounts } = calculateGlobalDiscount(
    netAfterLineDiscounts,
    cart.globalDiscountPercent,
    cart.globalDiscountAmount,
  );
  const logisticsCost = round(cart.logistics?.cost ?? 0);
  const tax = round(lineSummaries.reduce((acc, summary) => acc + summary.tax, 0));
  const totalBeforeLogistics = Math.max(0, netAfterLineDiscounts - globalDiscounts + tax);
  const total = Math.max(0, round(totalBeforeLogistics + logisticsCost));
  const units = round(cart.lines.reduce((acc, line) => acc + line.quantity, 0), 3);
  const weightKg = round(cart.lines.reduce((acc, line) => acc + line.weightKg * line.quantity, 0), 3);

  return {
    subtotal,
    lineDiscounts,
    globalDiscounts,
    logisticsCost,
    tax,
    total,
    units,
    weightKg,
  };
};

export const deserializeCartSnapshot = (raw: unknown): CartSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const draft = raw as Partial<CartSnapshot> & { lines?: unknown[] };

  const lines: CartLine[] = [];
  if (Array.isArray(draft.lines)) {
    for (const candidate of draft.lines) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Partial<CartLine> & {
        discount?: { type?: unknown; value?: unknown };
      };
      if (!item.productId || !item.name) continue;
      lines.push({
        lineId: String(item.lineId ?? crypto.randomUUID()),
        productId: String(item.productId),
        code: String(item.code ?? item.productId ?? ''),
        name: String(item.name ?? ''),
        price: toNumber(item.price) || 0,
        iva: toNumber(item.iva) || 0,
        quantity: Math.max(0.0001, toNumber(item.quantity) || 1),
        unit: String(item.unit ?? 'Un'),
        multiple: Math.max(0.0001, toNumber(item.multiple) || 1),
        weightKg: Math.max(0, toNumber(item.weightKg) || 0),
        discount: item.discount
          ? {
              type:
                item.discount.type === 'percent' || item.discount.type === 'amount'
                  ? item.discount.type
                  : null,
              value: toNumber(item.discount.value) || 0,
            }
          : null,
        note: item.note ? String(item.note) : undefined,
      });
    }
  }

  return {
    lines,
    client: draft.client ?? null,
    logistics: {
      mode: draft.logistics?.mode === 'delivery' ? 'delivery' : 'pickup',
      storeId: draft.logistics?.storeId,
      scheduledDate: draft.logistics?.scheduledDate,
      address: draft.logistics?.address,
      cost: toNumber(draft.logistics?.cost) || 0,
      notes: draft.logistics?.notes,
    },
    globalDiscountPercent: toNumber(draft.globalDiscountPercent) || 0,
    globalDiscountAmount: toNumber(draft.globalDiscountAmount) || 0,
    note: draft.note,
    payments: Array.isArray(draft.payments)
      ? draft.payments.map((payment) => ({
          id: String(payment?.id ?? crypto.randomUUID()),
          method: String(payment?.method ?? ''),
          amount: toNumber(payment?.amount) || 0,
          installments: Number(payment?.installments ?? 1) || 1,
          interest: toNumber(payment?.interest) || 0,
          brand: payment?.brand ? String(payment.brand) : undefined,
          reference: payment?.reference ? String(payment.reference) : undefined,
        }))
      : [],
    simulatorTotals: draft.simulatorTotals,
    updatedAt: draft.updatedAt,
  } satisfies CartSnapshot;
};
