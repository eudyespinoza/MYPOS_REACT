
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { Product } from '@/types/product';
import { fetchProductAttributes } from '@/api/products';
import { queryKeys } from '@/api/queryKeys';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onAdd: (product: Product, quantity: number) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const ProductDetailModal = ({ open, onClose, product, onAdd }: Props) => {
  const productId = product?.id ?? '';

  const { data: attributes, isLoading } = useQuery({
    queryKey: queryKeys.productAttributes(productId),
    queryFn: () => fetchProductAttributes(productId),
    enabled: open && productId.length > 0,
  });

  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Producto · ${product.name}`} size="lg">
      <div className="space-y-6 text-sm text-slate-200">
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-400">Código</p>
            <p className="font-semibold text-slate-100">{product.code}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Precio</p>
            <p className="font-semibold text-primary-300">{formatCurrency(product.price)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">IVA</p>
            <p className="font-semibold text-slate-100">{product.iva}%</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Stock disponible</p>
            <p className="font-semibold text-slate-100">{product.stock}</p>
          </div>
        </section>

        {product.description ? (
          <section className="space-y-1">
            <h4 className="text-xs uppercase text-slate-400">Descripción</h4>
            <p className="text-sm text-slate-200">{product.description}</p>
          </section>
        ) : null}

        <section className="space-y-2">
          <h4 className="text-xs uppercase text-slate-400">Atributos</h4>
          {isLoading ? (
            <p className="text-xs text-slate-400">Cargando atributos…</p>
          ) : attributes && typeof attributes === 'object' ? (
            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
              {JSON.stringify(attributes, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-slate-400">Sin datos adicionales.</p>
          )}
        </section>

        <footer className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className={clsx(
              'rounded-lg bg-primary-500 px-4 py-2 text-xs font-semibold text-white shadow transition',
              'hover:bg-primary-400',
            )}
            onClick={() => onAdd(product, 1)}
          >
            Agregar al carrito
          </button>
        </footer>
      </div>
    </Modal>
  );
};
