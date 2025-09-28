import { get } from './http';
import { normalizeProduct, normalizeStockRow } from '@/utils/normalizers';
import type { Product, ProductResponse } from '@/types/product';
import type { StockRow, StockRowResponse } from '@/types/stock';
import type { SortOption, StockFilters } from '@/stores/useFiltersStore';

const buildQuery = (params: Record<string, string | number | boolean | null | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter((item): item is string => item.length > 0);
};

export interface SearchProductsParams {
  storeId?: string | null;
  query?: string;
  category?: string;
  coverageGroup?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  stock?: StockFilters;
  sort?: SortOption;
  page?: number;
  perPage?: number;
}

interface SearchProductsApiResponse {
  items?: ProductResponse[];
  total?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
  facets?: {
    categories?: string[];
    coverage_groups?: string[];
  };
  categories?: string[];
  coverage_groups?: string[];
}

export interface ProductsSearchResult {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  categories: string[];
  coverageGroups: string[];
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;

export const searchProducts = async (params: SearchProductsParams): Promise<ProductsSearchResult> => {
  const query = buildQuery({
    store: params.storeId ?? undefined,
    query: params.query ?? undefined,
    category: params.category ?? undefined,
    coverage_group: params.coverageGroup ?? undefined,
    min_price: params.minPrice ?? undefined,
    max_price: params.maxPrice ?? undefined,
    stock_positive: params.stock?.positive,
    stock_zero: params.stock?.zero,
    stock_negative: params.stock?.negative,
    sort: params.sort ?? undefined,
    page: params.page ?? undefined,
    per_page: params.perPage ?? undefined,
  });

  const data = await get<SearchProductsApiResponse>(`/api/productos/search${query}`);

  const items = Array.isArray(data?.items) ? data.items.map(normalizeProduct) : [];
  const page = typeof data?.page === 'number' ? data.page : params.page ?? DEFAULT_PAGE;
  const perPage = typeof data?.per_page === 'number' ? data.per_page : params.perPage ?? DEFAULT_PER_PAGE;
  const total = typeof data?.total === 'number' ? data.total : items.length;
  const totalPages = typeof data?.total_pages === 'number' ? data.total_pages : Math.max(1, Math.ceil(total / perPage));
  const facets = data?.facets ?? {};
  const categories = toStringArray(facets.categories ?? data?.categories);
  const coverageGroups = toStringArray(facets.coverage_groups ?? data?.coverage_groups);

  return {
    items,
    total,
    page,
    perPage,
    totalPages,
    categories,
    coverageGroups,
  };
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
