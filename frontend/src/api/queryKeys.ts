export const queryKeys = {
  products: (storeId: string) => ['products', storeId] as const,
  productByCode: (code: string, storeId?: string | null) => ['productByCode', code, storeId ?? ''] as const,
  stock: (code: string, storeId: string) => ['stock', code, storeId] as const,
  productAttributes: (productId: string) => ['productAttributes', productId] as const,
  clients: (query: string) => ['clients', query] as const,
  remoteCart: ['remoteCart'] as const,
  userInfo: ['userInfo'] as const,
};
