import { useEffect, useState } from 'react';
import type { LogisticsInfo } from '@/types/cart';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  initial: LogisticsInfo;
  onSave: (logistics: LogisticsInfo) => void;
  stores: string[];
}

const defaultLogistics: LogisticsInfo = {
  mode: 'pickup',
  cost: 0,
  storeId: undefined,
  scheduledDate: undefined,
  address: undefined,
  notes: undefined,
};

export const LogisticsSelector = ({ open, onClose, initial, onSave, stores }: Props) => {
  const [draft, setDraft] = useState<LogisticsInfo>(initial ?? defaultLogistics);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? defaultLogistics);
  }, [open, initial]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({ ...draft, cost: Number.isFinite(draft.cost) ? Number(draft.cost) : 0 });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Logística" size="md">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
            <input
              type="radio"
              name="logistics-mode"
              className="accent-primary-500"
              checked={draft.mode === 'pickup'}
              onChange={() => setDraft((prev) => ({ ...prev, mode: 'pickup' }))}
            />
            <div>
              <div className="text-sm font-semibold text-slate-100">Retiro en sucursal</div>
              <div className="text-xs text-slate-400">Sin costo adicional</div>
            </div>
          </label>
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
            <input
              type="radio"
              name="logistics-mode"
              className="accent-primary-500"
              checked={draft.mode === 'delivery'}
              onChange={() => setDraft((prev) => ({ ...prev, mode: 'delivery' }))}
            />
            <div>
              <div className="text-sm font-semibold text-slate-100">Envío a domicilio</div>
              <div className="text-xs text-slate-400">Agregar dirección y costo</div>
            </div>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sucursal</label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              value={draft.storeId ?? ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, storeId: event.target.value || undefined }))}
            >
              <option value="">Seleccionar</option>
              {stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha estimada</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              value={draft.scheduledDate ?? ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, scheduledDate: event.target.value || undefined }))}
            />
          </div>
        </div>

        {draft.mode === 'delivery' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dirección</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                value={draft.address ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Costo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                value={draft.cost ?? 0}
                onChange={(event) => setDraft((prev) => ({ ...prev, cost: Number(event.target.value) }))}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
            value={draft.notes ?? ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-400"
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
};
