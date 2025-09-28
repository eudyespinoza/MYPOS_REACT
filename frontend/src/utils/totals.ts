import type { CartLine, CartSnapshot, CartTotals, LogisticsInfo } from '@/types/cart';
import { clamp, round, toNumber } from './number';
import { normalizeLegacyClient } from './normalizers';

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

const optionalString = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return `${value}`;
  }
  return undefined;
};

const requiredString = (value: unknown, fallback: string): string => optionalString(value) ?? fallback;

const fallbackUuid = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const numericInput = (value: unknown): number | string | null | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value == null) return value;
  return undefined;
};

const parseLogistics = (raw: unknown): LogisticsInfo => {
  const base: LogisticsInfo = {
    mode: 'pickup',
    cost: 0,
  };
  if (!raw || typeof raw !== 'object') return { ...base };
  const source = raw as Record<string, unknown>;
  const get = (key: string): unknown => source[key];
  const modeRaw = optionalString(get('mode')) ?? optionalString(get('tipo'));
  let mode: LogisticsInfo['mode'] = 'pickup';
  if (modeRaw) {
    const lowered = modeRaw.toLowerCase();
    if (lowered === 'delivery' || lowered === 'envio' || lowered === 'entrega') mode = 'delivery';
    else if (lowered === 'pickup' || lowered === 'retiro') mode = 'pickup';
  }
  const storeId = optionalString(get('storeId')) ?? optionalString(get('sucursal'));
  const scheduledDate = optionalString(get('scheduledDate')) ?? optionalString(get('fecha'));
  const address = optionalString(get('address')) ?? optionalString(get('direccion'));
  const notes = optionalString(get('notes')) ?? optionalString(get('obs'));
  const costSource = get('cost') ?? get('costo');
  const cost = Math.max(0, toNumber(numericInput(costSource)) || 0);

  return {
    mode,
    storeId,
    scheduledDate,
    address,
    cost,
    notes,
  } satisfies LogisticsInfo;
};

const parseLineCandidate = (candidate: unknown): CartLine | null => {
  if (!candidate || typeof candidate !== 'object') return null;
  const source = candidate as Record<string, unknown> & {
    discount?: { type?: unknown; value?: unknown } | null;
  };
  const get = (key: string): unknown => source[key];
  const productId = optionalString(
    get('productId') ??
      get('product_id') ??
      get('id') ??
      get('codigo') ??
      get('code') ??
      get('sku') ??
      get('numero_producto'),
  );
  if (!productId) return null;
  const name = requiredString(get('name') ?? get('nombre') ?? get('descripcion'), productId);
  const code = requiredString(get('code') ?? get('sku') ?? get('numero_producto') ?? get('codigo'), productId);
  const lineId = requiredString(get('lineId') ?? get('line_id'), fallbackUuid());
  const price = toNumber(
    numericInput(get('price') ?? get('precio') ?? get('precio_unit')),
  ) || 0;
  const iva = toNumber(numericInput(get('iva') ?? get('taxRate') ?? get('tax_rate'))) || 0;
  const quantity = Math.max(
    0.0001,
    toNumber(numericInput(get('quantity') ?? get('cantidad'))) || 1,
  );
  const unit = requiredString(get('unit') ?? get('unidad'), 'Un');
  const multiple = Math.max(
    0.0001,
    toNumber(numericInput(get('multiple') ?? get('multiplo'))) || 1,
  );
  const weightKg = Math.max(
    0,
    toNumber(numericInput(get('weightKg') ?? get('pesoKg') ?? get('peso'))) || 0,
  );

  let discount: CartLine['discount'] = null;
  const discountCandidate = source.discount;
  if (discountCandidate && typeof discountCandidate === 'object') {
    const type = discountCandidate.type === 'percent' || discountCandidate.type === 'amount' ? discountCandidate.type : null;
    discount = type
      ? {
          type,
          value: toNumber(numericInput(discountCandidate.value)) || 0,
        }
      : null;
  } else {
    const percent = toNumber(numericInput(get('discountPercent') ?? get('descuentoPorcentaje')));
    const amount = toNumber(numericInput(get('discountAmount') ?? get('descuentoMonto')));
    if (percent) {
      discount = {
        type: 'percent',
        value: percent,
      };
    } else if (amount) {
      discount = {
        type: 'amount',
        value: amount,
      };
    }
  }

  const note = optionalString(get('note') ?? get('nota'));

  return {
    lineId,
    productId,
    code,
    name,
    price,
    iva,
    quantity,
    unit,
    multiple,
    weightKg,
    discount,
    note,
  } satisfies CartLine;
};

export interface DeserializeCartSnapshotMeta {
  converted?: boolean;
}

export const deserializeCartSnapshot = (
  raw: unknown,
  meta?: DeserializeCartSnapshotMeta,
): CartSnapshot | null => {
  if (!raw || typeof raw !== 'object') {
    if (meta) meta.converted = false;
    return null;
  }

  const draft = raw as Partial<CartSnapshot> & {
    lines?: unknown[];
    items?: unknown[];
    descPorcentaje?: unknown;
    descMonto?: unknown;
    logistica?: unknown;
    cliente?: unknown;
  };

  let converted = false;

  const lines: CartLine[] = [];
  if (Array.isArray(draft.lines)) {
    for (const candidate of draft.lines) {
      const parsed = parseLineCandidate(candidate);
      if (parsed) lines.push(parsed);
    }
  }

  const legacyItems = Array.isArray(draft.items) ? draft.items : undefined;
  if (!lines.length && legacyItems) {
    for (const candidate of legacyItems) {
      const parsed = parseLineCandidate(candidate);
      if (parsed) lines.push(parsed);
    }
    if (lines.length) converted = true;
  }

  const rawClient = (draft.client as unknown) ?? draft.cliente ?? null;
  const client = normalizeLegacyClient(rawClient) ?? null;
  if (!draft.client && draft.cliente && client) converted = true;

  const hasLegacyPercent = draft.globalDiscountPercent == null && draft.descPorcentaje != null;
  const hasLegacyAmount = draft.globalDiscountAmount == null && draft.descMonto != null;
  if (hasLegacyPercent || hasLegacyAmount) converted = true;

  const globalDiscountPercent =
    toNumber(
      numericInput(
        draft.globalDiscountPercent ?? (hasLegacyPercent ? draft.descPorcentaje : undefined),
      ),
    ) || 0;
  const globalDiscountAmount =
    toNumber(
      numericInput(
        draft.globalDiscountAmount ?? (hasLegacyAmount ? draft.descMonto : undefined),
      ),
    ) || 0;

  const usedLegacyLogistics = !draft.logistics && draft.logistica;
  if (usedLegacyLogistics) converted = true;
  const logisticsSource = draft.logistics ?? draft.logistica;
  const logistics = parseLogistics(logisticsSource);

  const note = optionalString(draft.note ?? (draft as Record<string, unknown>)['observaciones']) ?? undefined;

  const payments = Array.isArray(draft.payments)
    ? draft.payments.map((payment) => ({
        id: requiredString(payment?.id, fallbackUuid()),
        method: requiredString(payment?.method, ''),
        amount: toNumber(numericInput(payment?.amount)) || 0,
        installments: Number(payment?.installments ?? 1) || 1,
        interest: toNumber(numericInput(payment?.interest)) || 0,
        brand: optionalString(payment?.brand),
        reference: optionalString(payment?.reference),
      }))
    : [];

  const snapshot: CartSnapshot = {
    lines,
    client,
    logistics,
    globalDiscountPercent,
    globalDiscountAmount,
    note,
    payments,
    simulatorTotals: draft.simulatorTotals,
    updatedAt: draft.updatedAt,
  };

  if (meta) meta.converted = converted;

  return snapshot;
};
