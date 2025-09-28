import type { Product, ProductResponse } from '@/types/product';
import type { Client, ClientResponse } from '@/types/client';
import type { StockRow, StockRowResponse } from '@/types/stock';
import { toNumber } from './number';

const fallbackId = (): string => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const stringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : fallback;
};

export const normalizeProduct = (raw: ProductResponse): Product => {
  const idSource = raw.numero_producto ?? raw.productId ?? raw.id ?? fallbackId();
  const id = stringValue(idSource, fallbackId());
  const code = stringValue(raw.numero_producto ?? raw.id ?? id, id);
  const name = stringValue(
    raw.nombre_producto ?? raw.productName ?? raw.nombre ?? raw.descripcion ?? raw.descripcion_corta,
    'Producto',
  );
  const description = stringValue(raw.descripcion ?? raw.descripcion_corta ?? raw.nombre ?? '', '');
  const category = stringValue(raw.categoria_producto ?? raw.categoria ?? '', '');
  const coverageGroup = stringValue(raw.grupo_cobertura ?? '', '');
  const barcode = stringValue(raw.barcode ?? raw.codigo_barras ?? '', '');
  const brand = stringValue(raw.marca ?? raw.brand ?? '', '');
  const price = toNumber(
    raw.precio_final_con_descuento ?? raw.precio_final_con_iva ?? raw.precio ?? 0,
  );
  const iva = toNumber(raw.iva ?? 21);
  const stock = toNumber(raw.total_disponible_venta ?? raw.stock ?? 0);
  const weightKg = toNumber(raw.pesoKg ?? 0);
  const unit = stringValue(raw.unidad_medida ?? raw.unidad ?? 'Un', 'Un');
  const multiple = toNumber(raw.multiplo ?? 1) || 1;
  const imageUrl = raw.imagen_url ?? null;

  return {
    id,
    code,
    name,
    description,
    category,
    price,
    iva,
    stock,
    weightKg,
    unit,
    multiple,
    coverageGroup,
    barcode,
    brand,
    imageUrl,
  } satisfies Product;
};

export const normalizeClient = (raw: ClientResponse): Client => {
  const idSource = raw.numero_cliente ?? raw.id ?? fallbackId();
  const id = stringValue(idSource, fallbackId());
  const composedName = [raw.nombre, raw.apellido].filter(Boolean).map((part) => stringValue(part)).join(' ');
  const name = stringValue(
    raw.nombre_completo ??
      raw.nombre_cliente ??
      raw.full_name ??
      raw.display_name ??
      raw.razon_social ??
      composedName,
    String(id),
  );
  const document = stringValue(
    raw.nif ?? raw.doc ?? raw.dni ?? raw.cuit ?? raw.numero_cliente ?? '',
    undefined,
  ) || undefined;
  const email = stringValue(raw.email ?? '', '') || undefined;
  const phone = stringValue(raw.telefono ?? raw.phone ?? '', '') || undefined;
  const composedAddress = [raw.calle, raw.altura]
    .map((part) => stringValue(part ?? ''))
    .filter(Boolean)
    .join(' ');
  const address =
    stringValue(
      raw.direccion_completa ??
        raw.direccion ??
        raw.address ??
        composedAddress,
      '',
    ) || undefined;
  const preferredStoreId = stringValue(raw.store_preferida ?? '', '') || undefined;

  return {
    id,
    name,
    document,
    email,
    phone,
    address,
    preferredStoreId,
  } satisfies Client;
};

export const normalizeStockRow = (raw: StockRowResponse): StockRow => {
  const storeName = stringValue(
    raw.almacen ?? raw.almacen_nombre ?? raw.warehouse ?? raw.Warehouse ?? raw.store ?? '—',
    '—',
  );
  const availableForSale = toNumber(raw.disponible_venta ?? raw.stock_venta ?? raw.disponible ?? 0);
  const availableForDelivery = toNumber(raw.disponible_entrega ?? raw.disponible_ent ?? 0);
  const committed = toNumber(raw.comprometido ?? raw.reservado ?? 0);
  return {
    storeName,
    availableForSale,
    availableForDelivery,
    committed,
  } satisfies StockRow;
};
