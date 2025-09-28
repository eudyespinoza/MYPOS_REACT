import type { SortOption, StockFilters } from '@/stores/useFiltersStore';

export interface ProductsQueryKey {
  storeId: string | null;
  query: string;
  category: string;
  coverageGroup: string;
  minPrice: number | null;
  maxPrice: number | null;
  stock: StockFilters;
  sort: SortOption;
  page: number;
  perPage: number;
}

export const queryKeys = {
  products: (params: ProductsQueryKey) =>
    [
      'products',
      params.storeId ?? '',
      params.query,
      params.category,
      params.coverageGroup,
      params.minPrice ?? '',
      params.maxPrice ?? '',
      params.stock.positive,
      params.stock.zero,
      params.stock.negative,
      params.sort,
      params.page,
      params.perPage,
    ] as const,
  productByCode: (code: string, storeId?: string | null) => ['productByCode', code, storeId ?? ''] as const,
  stock: (code: string, storeId: string) => ['stock', code, storeId] as const,
  productAttributes: (productId: string) => ['productAttributes', productId] as const,
  clients: (query: string) => ['clients', query] as const,
  remoteCart: ['remoteCart'] as const,
  userInfo: ['userInfo'] as const,
};
