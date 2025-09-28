import { get } from './http';
import { normalizeProduct, normalizeStockRow } from '@/utils/normalizers';
import type { Product, ProductResponse } from '@/types/product';
import type { StockRow, StockRowResponse } from '@/types/stock';

const PAGE_SIZE = 5000;
const MAX_PAGES = 200;

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const fetchAllProducts = async (storeId: string): Promise<Product[]> => {
  const results: Product[] = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const query = buildQuery({ store: storeId, page, items_per_page: PAGE_SIZE });
    const data = await get<ProductResponse[]>(`/api/productos${query}`);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data.map(normalizeProduct));
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return results;
};

export const fetchProductByCode = async (
  code: string,
  storeId?: string | null,
): Promise<Product | null> => {
  if (!code) return null;
  const query = buildQuery({ code, store: storeId ?? undefined });
  const data = await get<ProductResponse[]>(`/api/productos/by_code${query}`);
  if (!Array.isArray(data) || data.length === 0) return null;
  return normalizeProduct(data[0]);
};

export const fetchStockByStore = async (productCode: string, storeId: string): Promise<StockRow[]> => {
  const data = await get<StockRowResponse[]>(`/api/stock/${encodeURIComponent(productCode)}/${encodeURIComponent(storeId)}`);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeStockRow);
};

export const fetchProductAttributes = async (productId: string): Promise<unknown> => {
  return get(`/producto/atributos/${encodeURIComponent(productId)}`, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
};
