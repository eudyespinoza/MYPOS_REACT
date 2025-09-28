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
  const address = stringValue(
    raw.direccion_completa ?? raw.direccion ?? raw.address ?? '',
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

export const normalizeLegacyClient = (raw: unknown): Client | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  const get = (key: string): unknown => candidate[key];

  const isModernShape =
    typeof get('id') === 'string' &&
    typeof get('name') === 'string' &&
    !('numero_cliente' in candidate) &&
    !('nombre_cliente' in candidate) &&
    !('nif' in candidate) &&
    !('dni' in candidate) &&
    !('doc' in candidate);

  if (isModernShape) {
    const id = stringValue(get('id'), fallbackId());
    const name = stringValue(get('name'), id);
    const document = stringValue(get('document'), '') || undefined;
    const email = stringValue(get('email'), '') || undefined;
    const phone = stringValue(get('phone'), '') || undefined;
    const address = stringValue(get('address'), '') || undefined;
    const preferredStoreId = stringValue(get('preferredStoreId'), '') || undefined;
    return {
      id,
      name,
      document,
      email,
      phone,
      address,
      preferredStoreId,
    } satisfies Client;
  }

  const response: ClientResponse = {
    numero_cliente:
      (get('numero_cliente') as string | number | undefined) ??
      (get('id') as string | number | undefined) ??
      (get('nif') as string | undefined) ??
      (get('doc') as string | undefined) ??
      (get('dni') as string | undefined),
    id:
      (get('id') as string | number | undefined) ??
      (get('numero_cliente') as string | number | undefined) ??
      (get('nif') as string | undefined) ??
      (get('doc') as string | undefined) ??
      (get('dni') as string | undefined),
    nombre_completo: get('nombre_completo') as string | undefined,
    nombre_cliente: get('nombre_cliente') as string | undefined,
    full_name: get('full_name') as string | undefined,
    display_name: get('display_name') as string | undefined,
    razon_social: get('razon_social') as string | undefined,
    nombre: get('nombre') as string | undefined,
    apellido: get('apellido') as string | undefined,
    doc: (get('doc') as string | undefined) ?? (get('nif') as string | undefined),
    dni: get('dni') as string | undefined,
    nif: get('nif') as string | undefined,
    cuit: get('cuit') as string | undefined,
    email:
      (get('email') as string | undefined) ??
      (get('email_contacto') as string | undefined) ??
      (get('emailContacto') as string | undefined),
    telefono:
      (get('telefono') as string | undefined) ??
      (get('telefono_contacto') as string | undefined) ??
      (get('telefonoContacto') as string | undefined),
    phone: get('phone') as string | undefined,
    direccion: get('direccion') as string | undefined,
    direccion_completa: get('direccion_completa') as string | undefined,
    address: get('address') as string | undefined,
    store_preferida: get('store_preferida') as string | undefined,
  } satisfies ClientResponse;

  return normalizeClient(response);
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
