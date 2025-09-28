import type { Product } from '@/types/product';
import { clsx } from 'clsx';

interface Props {
  product: Product;
  onAdd: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onViewStock: (product: Product) => void;
  disabled?: boolean;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const ProductResultCard = ({ product, onAdd, onViewDetails, onViewStock, disabled }: Props) => {
  return (
    <article
      tabIndex={0}
      className={clsx(
        'group flex h-full flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-slate-100 shadow-sm transition hover:border-primary-500/70 focus-visible:border-primary-500 focus-visible:outline-none',
        disabled && 'opacity-60'
      )}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          onAdd(product);
        }
        if (event.key === '.' || event.key === 'ArrowRight') {
          event.preventDefault();
          onViewDetails(product);
        }
        if (event.key.toLowerCase() === 's') {
          event.preventDefault();
          onViewStock(product);
        }
      }}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-tight text-slate-50">{product.name}</h3>
          <p className="text-xs text-slate-400">{product.code}</p>
        </div>
        <span className="rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300">
          {product.unit}
        </span>
      </header>

      <div className="space-y-2">
        <p className="text-base font-semibold text-primary-400">{formatCurrency(product.price)}</p>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>IVA: {product.iva}%</span>
          <span>Stock: {product.stock}</span>
        </div>
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          className="flex-1 rounded-lg bg-primary-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-500 disabled:opacity-60"
          disabled={disabled}
          onClick={() => onAdd(product)}
        >
          Agregar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-primary-400 hover:text-primary-300"
            onClick={() => onViewDetails(product)}
            disabled={disabled}
          >
            Detalle ·
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-primary-400 hover:text-primary-300"
            onClick={() => onViewStock(product)}
            disabled={disabled}
          >
            Stock S
          </button>
        </div>
      </footer>
    </article>
  );
};
