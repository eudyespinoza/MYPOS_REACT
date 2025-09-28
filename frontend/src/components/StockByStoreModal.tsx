
import { useQuery } from '@tanstack/react-query';
import type { Product } from '@/types/product';
import type { StockRow } from '@/types/stock';
import { fetchStockByStore } from '@/api/products';
import { queryKeys } from '@/api/queryKeys';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  storeId: string | null;
}

export const StockByStoreModal = ({ open, onClose, product, storeId }: Props) => {
  const { data: stockRows = [], isLoading } = useQuery<StockRow[]>({
    queryKey: queryKeys.stock(product?.code ?? 'unknown', storeId ?? 'unknown'),
    queryFn: () => fetchStockByStore(product!.code, storeId!),
    enabled: open && !!product && !!storeId,
  });

  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Stock · ${product.name}`} size="md">
      {isLoading ? (
        <p className="text-sm text-slate-300">Cargando stock…</p>
      ) : stockRows.length ? (
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="py-2">Almacén</th>
              <th className="py-2 text-right">Venta</th>
              <th className="py-2 text-right">Entrega</th>
              <th className="py-2 text-right">Comprometido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {stockRows.map((row) => (
              <tr key={row.storeName}>
                <td className="py-2 pr-2">{row.storeName}</td>
                <td className="py-2 text-right">{row.availableForSale}</td>
                <td className="py-2 text-right">{row.availableForDelivery}</td>
                <td className="py-2 text-right">{row.committed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-300">No se encontraron datos de stock.</p>
      )}
    </Modal>
  );
};
