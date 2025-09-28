
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchUserInfo, fetchRemoteCart, updateLastStore } from '@/api/cart';
import type { UserInfoResponse } from '@/api/cart';
import { fetchAllProducts, fetchProductByCode } from '@/api/products';
import { queryKeys } from '@/api/queryKeys';
import { useCartStore } from '@/stores/useCartStore';
import { useFiltersStore } from '@/stores/useFiltersStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUiStore } from '@/stores/useUiStore';
import { useToastStore } from '@/stores/useToastStore';
import { useCartRemoteSync } from '@/hooks/useCartRemoteSync';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useBarcode } from '@/hooks/useBarcode';
import { TopBar } from '@/components/TopBar';
import { CartPanel } from '@/components/CartPanel';
import { ProductResultCard } from '@/components/ProductResultCard';
import { ProductDetailModal } from '@/components/ProductDetailModal';
import { StockByStoreModal } from '@/components/StockByStoreModal';
import { ClientSearch } from '@/components/ClientSearch';
import { Modal } from '@/components/Modal';
import { AuxiliarySearchPanels } from '@/components/AuxiliarySearchPanels';
import { getBootstrapData } from '@/utils/bootstrap';
import type { Product } from '@/types/product';
import type { CartSnapshot } from '@/types/cart';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[^\w\s.-]/g, '')
    .toLowerCase()
    .trim();

const matchesTokens = (haystack: string[], tokens: string[]) =>
  tokens.every((token) => haystack.some((value) => value.includes(token)));

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

export const POSPage = () => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pushToast = useToastStore((state) => state.pushToast);

  const {
    isCartOpen,
    setCartOpen,
    setClientsPanelOpen,
    isClientsPanelOpen,
    isHelpOpen,
    setHelpOpen,
    setSimulatorOpen,
    setLogisticsOpen,
    setPaymentsOpen,
    setDiscountsOpen,
    hotkeys,
    theme,
    toggleTheme,
  } = useUiStore();

  const {
    addProduct,
    hydrateRemoteCart,
    cart,
    needsSync,
    isSyncing,
    setClient,
    remoteError,
  } = useCartStore((state) => ({
    addProduct: state.addProduct,
    hydrateRemoteCart: state.hydrateRemoteCart,
    cart: state.cart,
    needsSync: state.needsSync,
    isSyncing: state.isSyncing,
    setClient: state.setClient,
    remoteError: state.remoteError,
  }));

  const {
    query,
    category,
    coverageGroup,
    minPrice,
    maxPrice,
    stock,
    sort,
    page,
    perPage,
    storeId,
  } = useFiltersStore();

  const setQuery = useFiltersStore((state) => state.setQuery);
  const setStoreId = useFiltersStore((state) => state.setStoreId);
  const setCategory = useFiltersStore((state) => state.setCategory);
  const setCoverageGroup = useFiltersStore((state) => state.setCoverageGroup);
  const setPriceRange = useFiltersStore((state) => state.setPriceRange);
  const setStockFilter = useFiltersStore((state) => state.setStockFilter);
  const setSort = useFiltersStore((state) => state.setSort);
  const setPage = useFiltersStore((state) => state.setPage);
  const setPerPage = useFiltersStore((state) => state.setPerPage);
  const resetFilters = useFiltersStore((state) => state.resetFilters);

  const { setUser, setStores, stores } = useSessionStore((state) => ({
    setUser: state.setUser,
    setStores: state.setStores,
    stores: state.stores,
  }));

  const { syncNow, isOnline } = useCartRemoteSync();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  const bootstrapData = useMemo(() => getBootstrapData(), []);

  useEffect(() => {
    if (!stores.length && bootstrapData.stores?.length) {
      setStores(bootstrapData.stores);
    }
  }, [bootstrapData, setStores, stores.length]);

  useEffect(() => {
    if (storeId) return;
    const fallbackStore = bootstrapData.lastStoreId ?? bootstrapData.stores?.[0] ?? null;
    if (fallbackStore) {
      setStoreId(fallbackStore);
    }
  }, [bootstrapData, setStoreId, storeId]);

  const userInfoQuery = useQuery<UserInfoResponse>({
    queryKey: queryKeys.userInfo,
    queryFn: fetchUserInfo,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!userInfoQuery.error) return;
    pushToast({
      tone: 'error',
      title: 'No se pudo obtener la sesión',
      description: getErrorMessage(
        userInfoQuery.error,
        'Reintenta más tarde o vuelve a iniciar sesión.',
      ),
    });
  }, [pushToast, userInfoQuery.error]);

  useEffect(() => {
    if (!userInfoQuery.data) return;
    const info = userInfoQuery.data;
    if (info.email || info.username) {
      setUser({ email: info.email ?? info.username ?? null, name: info.full_name ?? null });
    }
    const availableStores = info.stores ?? info.available_stores ?? info.stores_available ?? [];
    if (availableStores.length) {
      setStores(availableStores);
      if (!storeId) {
        setStoreId(info.last_store ?? availableStores[0]);
      }
      return;
    }

    if (!stores.length && bootstrapData.stores?.length) {
      setStores(bootstrapData.stores);
    }
    if (!storeId) {
      const fallbackStore =
        info.last_store ?? bootstrapData.lastStoreId ?? bootstrapData.stores?.[0] ?? null;
      if (fallbackStore) {
        setStoreId(fallbackStore);
      }
    }
  }, [
    bootstrapData,
    setUser,
    setStores,
    storeId,
    setStoreId,
    stores.length,
    userInfoQuery.data,
  ]);

  const remoteCartQuery = useQuery<CartSnapshot | null>({
    queryKey: queryKeys.remoteCart,
    queryFn: fetchRemoteCart,
    enabled: !!userInfoQuery.data?.email,
  });

  useEffect(() => {
    if (!remoteCartQuery.data) return;
    hydrateRemoteCart(remoteCartQuery.data);
  }, [hydrateRemoteCart, remoteCartQuery.data]);

  useEffect(() => {
    if (!remoteCartQuery.error) return;
    pushToast({
      tone: 'warning',
      title: 'No se pudo cargar el carrito remoto',
      description: getErrorMessage(remoteCartQuery.error, 'Puedes seguir operando offline.'),
    });
  }, [pushToast, remoteCartQuery.error]);

  const productsQuery = useQuery<Product[]>({
    queryKey: storeId ? queryKeys.products(storeId) : ['products', 'default'],
    queryFn: () => fetchAllProducts(storeId ?? ''),
    enabled: Boolean(storeId),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!productsQuery.error) return;
    pushToast({
      tone: 'error',
      title: 'Error al cargar productos',
      description: getErrorMessage(
        productsQuery.error,
        'Revisa la conexión e intenta nuevamente.',
      ),
    });
  }, [productsQuery.error, pushToast]);

  const updateStoreMutation = useMutation({
    mutationFn: (value: string) => updateLastStore(value),
    onError: (error) =>
      pushToast({
        tone: 'warning',
        title: 'No se pudo actualizar la sucursal preferida',
        description: getErrorMessage(error, 'Los cambios se guardarán cuando vuelva la conexión.'),
      }),
  });

  const barcodeMutation = useMutation({
    mutationFn: (code: string) => fetchProductByCode(code, storeId),
    onSuccess: (product) => {
      if (product) {
        addProduct(product, product.multiple || 1);
        setCartOpen(true);
        pushToast({ tone: 'success', title: `${product.name} agregado`, description: `Código ${product.code}` });
      }
    },
    onError: (error) =>
      pushToast({
        tone: 'warning',
        title: 'No se encontró el producto escaneado',
        description: getErrorMessage(error, 'Verifica el código o intenta desde la búsqueda manual.'),
      }),
  });

  const products = productsQuery.data ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((product) => {
      if (product.category) set.add(product.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const coverageGroups = useMemo(() => {
    const set = new Set<string>();
    products.forEach((product) => {
      if (product.coverageGroup) set.add(product.coverageGroup);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const tokens = query ? normalize(query).split(/\s+/).filter(Boolean) : [];
    return products
      .filter((product) => {
        if (category && product.category !== category) return false;
        if (coverageGroup && normalize(product.coverageGroup ?? '') !== normalize(coverageGroup)) return false;
        if (minPrice != null && product.price < minPrice) return false;
        if (maxPrice != null && product.price > maxPrice) return false;
        const stockValue = product.stock ?? 0;
        if (!stock.positive && stockValue > 0) return false;
        if (!stock.zero && stockValue === 0) return false;
        if (!stock.negative && stockValue < 0) return false;
        if (tokens.length) {
          const haystack = [
            normalize(product.name),
            normalize(product.code),
            normalize(product.category ?? ''),
            normalize(product.coverageGroup ?? ''),
            normalize(product.barcode ?? ''),
          ];
          if (!matchesTokens(haystack, tokens)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case 'priceAsc':
            return a.price - b.price;
          case 'priceDesc':
            return b.price - a.price;
          case 'nameAsc':
            return a.name.localeCompare(b.name);
          case 'nameDesc':
            return b.name.localeCompare(a.name);
          case 'stockDesc':
            return (b.stock ?? 0) - (a.stock ?? 0);
          default:
            return 0;
        }
      });
  }, [products, query, category, coverageGroup, minPrice, maxPrice, stock, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredProducts.slice(start, start + perPage);
  }, [filteredProducts, page, perPage]);

  const handleStoreChange = (value: string) => {
    setStoreId(value);
    if (value) updateStoreMutation.mutate(value);
  };

  useHotkeys(
    [
      {
        combo: hotkeys.focusSearch,
        preventDefault: true,
        handler: () => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        },
      },
      {
        combo: hotkeys.toggleCart,
        preventDefault: true,
        handler: () => setCartOpen(!isCartOpen),
      },
      {
        combo: hotkeys.openDiscounts,
        preventDefault: true,
        handler: () => {
          if (cart.lines.length === 0) return;
          setDiscountsOpen(true);
          setCartOpen(true);
        },
      },
      {
        combo: hotkeys.openLogistics,
        preventDefault: true,
        handler: () => setLogisticsOpen(true),
      },
      {
        combo: hotkeys.openPayments,
        preventDefault: true,
        handler: () => setPaymentsOpen(true),
      },
      {
        combo: hotkeys.openClients,
        preventDefault: true,
        handler: () => setClientsPanelOpen(true),
      },
      {
        combo: hotkeys.openSimulator,
        preventDefault: true,
        handler: () => setSimulatorOpen(true),
      },
      {
        combo: hotkeys.saveCart,
        preventDefault: true,
        handler: () => syncNow(),
      },
      {
        combo: hotkeys.help,
        preventDefault: true,
        handler: () => setHelpOpen(true),
      },
    ],
    [
      isCartOpen,
      hotkeys,
      cart.lines.length,
      setCartOpen,
      setClientsPanelOpen,
      setSimulatorOpen,
      setLogisticsOpen,
      setPaymentsOpen,
      setDiscountsOpen,
      syncNow,
      setHelpOpen,
    ],
  );

  useEffect(() => {
    if (remoteError) {
      pushToast({
        tone: 'warning',
        title: 'Sincronización pendiente',
        description: remoteError,
      });
    }
  }, [remoteError, pushToast]);

  useBarcode({
    enabled: true,
    onScan: (code) => barcodeMutation.mutate(code),
  });

  const helpItems = useMemo(
    () => [
      { combo: hotkeys.focusSearch, description: 'Foco buscador' },
      { combo: hotkeys.toggleCart, description: 'Abrir/cerrar carrito' },
      { combo: hotkeys.openDiscounts, description: 'Descuento de línea' },
      { combo: hotkeys.openClients, description: 'Clientes' },
      { combo: hotkeys.openLogistics, description: 'Logística' },
      { combo: hotkeys.openPayments, description: 'Multipago placeholder' },
      { combo: hotkeys.openSimulator, description: 'Simulador pagos' },
      { combo: hotkeys.saveCart, description: 'Guardar carrito remoto' },
    ],
    [hotkeys],
  );

  const handleOrderSearch = (number: string) => {
    pushToast({
      tone: 'info',
      title: `Pedido ${number}`,
      description: 'La integración estará disponible en la próxima iteración.',
    });
  };

  const handleQuoteSearch = (number: string) => {
    pushToast({
      tone: 'info',
      title: `Presupuesto ${number}`,
      description: 'Podrás abrir el detalle cuando se conecte al backend.',
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-4 px-4 py-6 text-slate-100">
      <TopBar
        query={query}
        onQueryChange={setQuery}
        onClearQuery={() => setQuery('')}
        searchRef={searchInputRef}
        onBarcodeScan={(code) => barcodeMutation.mutate(code)}
        theme={theme}
        onToggleTheme={toggleTheme}
        stores={stores}
        currentStore={storeId}
        onStoreChange={handleStoreChange}
        isOnline={isOnline}
        needsSync={needsSync}
        isSyncing={isSyncing}
        lastSyncedAt={cart.updatedAt}
        onSaveCart={syncNow}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_minmax(0,28rem)]">
        <main className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg">
          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Categoría</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              value={coverageGroup}
              onChange={(event) => setCoverageGroup(event.target.value)}
            >
              <option value="">Cobertura</option>
              {coverageGroups.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Precio min"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                value={minPrice ?? ''}
                onChange={(event) => setPriceRange(event.target.value ? Number(event.target.value) : null, maxPrice)}
              />
              <input
                type="number"
                placeholder="Máx"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                value={maxPrice ?? ''}
                onChange={(event) => setPriceRange(minPrice, event.target.value ? Number(event.target.value) : null)}
              />
            </div>
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
            >
              <option value="relevance">Sin orden</option>
              <option value="priceAsc">Precio ⬆︎</option>
              <option value="priceDesc">Precio ⬇︎</option>
              <option value="nameAsc">Nombre A-Z</option>
              <option value="nameDesc">Nombre Z-A</option>
              <option value="stockDesc">Stock</option>
            </select>
          </section>

          <section className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary-500"
                checked={stock.positive}
                onChange={(event) => setStockFilter('positive', event.target.checked)}
              />
              Stock positivo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary-500"
                checked={stock.zero}
                onChange={(event) => setStockFilter('zero', event.target.checked)}
              />
              Stock cero
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary-500"
                checked={stock.negative}
                onChange={(event) => setStockFilter('negative', event.target.checked)}
              />
              Stock negativo
            </label>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
              onClick={resetFilters}
            >
              Limpiar filtros
            </button>
          </section>

          <section className="flex-1">
            {productsQuery.isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-300">Cargando productos...</div>
            ) : paginatedProducts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-300">Sin resultados con los filtros actuales.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {paginatedProducts.map((product) => (
                  <ProductResultCard
                    key={product.id}
                    product={product}
                    onAdd={() => addProduct(product, product.multiple || 1)}
                    onViewDetails={() => setSelectedProduct(product)}
                    onViewStock={() => setStockProduct(product)}
                  />
                ))}
              </div>
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <div>
              Página {page} de {totalPages} · {filteredProducts.length} resultados
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 hover:border-primary-400"
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 hover:border-primary-400"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
              >
                Siguiente
              </button>
              <select
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                value={perPage}
                onChange={(event) => setPerPage(Number(event.target.value))}
              >
                {[12, 20, 30, 40].map((option) => (
                  <option key={option} value={option}>
                    {option} por página
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </main>

        <CartPanel stores={stores} onOpenClients={() => setClientsPanelOpen(true)} />
      </div>

      <AuxiliarySearchPanels onSearchOrder={handleOrderSearch} onSearchQuote={handleQuoteSearch} />

      <ProductDetailModal
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onAdd={(product, quantity) => addProduct(product, quantity)}
      />

      <StockByStoreModal
        open={Boolean(stockProduct)}
        onClose={() => setStockProduct(null)}
        product={stockProduct}
        storeId={storeId}
      />

      <ClientSearch
        open={isClientsPanelOpen}
        onClose={() => setClientsPanelOpen(false)}
        onSelect={(client) => {
          setClient(client);
          setClientsPanelOpen(false);
        }}
      />

      <Modal open={isHelpOpen} onClose={() => setHelpOpen(false)} title="Atajos" size="sm">
        <ul className="space-y-2 text-sm text-slate-200">
          {helpItems.map((item) => (
            <li key={item.combo} className="flex justify-between gap-4">
              <span className="font-mono text-xs text-primary-200">{item.combo}</span>
              <span>{item.description}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};
