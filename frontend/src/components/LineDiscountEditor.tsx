
import { useEffect, useState } from 'react';
import type { LineDiscount } from '@/types/cart';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  initial: LineDiscount | null;
  onSave: (discount: LineDiscount | null) => void;
}

export const LineDiscountEditor = ({ open, onClose, initial, onSave }: Props) => {
  const [type, setType] = useState<LineDiscount['type']>(initial?.type ?? null);
  const [value, setValue] = useState(initial?.value ?? 0);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? null);
    setValue(initial?.value ?? 0);
  }, [open, initial]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!type) {
      onSave(null);
      onClose();
      return;
    }
    const numeric = Number.isFinite(value) ? Number(value) : 0;
    onSave({ type, value: numeric });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Descuento por línea" size="sm">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                type === 'percent'
                  ? 'border-primary-500 bg-primary-500/20 text-primary-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
              onClick={() => setType('percent')}
            >
              Porcentaje %
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                type === 'amount'
                  ? 'border-primary-500 bg-primary-500/20 text-primary-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
              onClick={() => setType('amount')}
            >
              Monto $
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            disabled={!type}
          />
        </div>

        <div className="flex justify-between gap-3 pt-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500"
            onClick={() => {
              setType(null);
              setValue(0);
              onSave(null);
              onClose();
            }}
          >
            Limpiar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-400 disabled:opacity-60"
            disabled={!type}
          >
            Aplicar
          </button>
        </div>
      </form>
    </Modal>
  );
};
