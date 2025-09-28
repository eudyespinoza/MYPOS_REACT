import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useCartStore } from '@/stores/useCartStore';
import { useUiStore } from '@/stores/useUiStore';
import { useToastStore } from '@/stores/useToastStore';
import { calculateLineTotals } from '@/utils/totals';
import { openQuotePrint } from '@/utils/print';
import type { CartLine } from '@/types/cart';
import { LineDiscountEditor } from './LineDiscountEditor';
import { LogisticsSelector } from './LogisticsSelector';
import { PaymentSimulatorModal } from './PaymentSimulatorModal';
import { Modal } from './Modal';

interface CartPanelProps {
  stores: string[];
  onOpenClients: () => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const CartPanel = ({ stores, onOpenClients }: CartPanelProps) => {
  const {
    cart,
    totals,
    removeLine,
    updateQuantity,
    setLineDiscount,
    setGlobalDiscounts,
    setLogistics,
    setNote,
    markSynced,
  } = useCartStore();
  const {
    isCartOpen,
    setCartOpen,
    isDiscountsOpen,
    setDiscountsOpen,
    isLogisticsOpen,
    setLogisticsOpen,
    isPaymentsOpen,
    setPaymentsOpen,
    isSimulatorOpen,
    setSimulatorOpen,
    hotkeys,
  } = useUiStore();

  const [targetLine, setTargetLine] = useState<CartLine | null>(null);
  const pushToast = useToastStore((state) => state.pushToast);

  const lineSummaries = useMemo(
    () =>
      cart.lines.map((line) => ({
        line,
        totals: calculateLineTotals(line),
      })),
    [cart.lines],
  );

  const totalItems = useMemo(
    () => cart.lines.reduce((acc, line) => acc + line.quantity, 0),
    [cart.lines],
  );

  useEffect(() => {
    if (!isDiscountsOpen) return;
    if (cart.lines.length === 0) {
      pushToast({
        tone: 'info',
        title: 'Sin productos en el carrito',
        description: 'Agrega un producto antes de asignar descuentos.',
      });
      setDiscountsOpen(false);
      return;
    }
    setTargetLine(cart.lines[0]);
    setDiscountsOpen(false);
  }, [isDiscountsOpen, cart.lines, setDiscountsOpen, pushToast]);

  return (
    <aside
      className={clsx(
        'flex h-full w-full flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-slate-100 shadow-lg transition md:w-[28rem]',
      )}
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Carrito</h2>
          <p className="text-xs text-slate-400">{totalItems} items</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
          onClick={() => setCartOpen(!isCartOpen)}
        >
          {isCartOpen ? 'Cerrar' : 'Abrir'} ({hotkeys.toggleCart})
        </button>
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto pr-1">
        {lineSummaries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            Agrega productos desde el buscador.
          </p>
        ) : (
          lineSummaries.map(({ line, totals }) => (
            <article
              key={line.lineId}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-100">{line.name}</h3>
                  <p className="text-xs text-slate-400">{line.code}</p>
                  <p className="text-xs text-slate-500">IVA {line.iva}%</p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-slate-500 transition hover:bg-slate-800 hover:text-red-300"
                  aria-label="Eliminar"
                  onClick={() => removeLine(line.lineId)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="mt-3 grid items-center gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase text-slate-500">Cantidad</label>
                  <div className="flex rounded-lg border border-slate-700 bg-slate-950">
                    <button
                      type="button"
                      className="px-3 text-sm text-slate-300 hover:text-white"
                      onClick={() => updateQuantity(line.lineId, Math.max(line.multiple, line.quantity - line.multiple))}
                    >
                      –
                    </button>
                    <input
                      type="number"
                      step={line.multiple}
                      min={line.multiple}
                      className="w-full bg-transparent text-center text-sm text-slate-100 focus:outline-none"
                      value={line.quantity}
                      onChange={(event) => updateQuantity(line.lineId, Number(event.target.value))}
                    />
                    <button
                      type="button"
                      className="px-3 text-sm text-slate-300 hover:text-white"
                      onClick={() => updateQuantity(line.lineId, line.quantity + line.multiple)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase text-slate-500">Descuento</label>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-primary-400 hover:text-primary-200"
                    onClick={() => setTargetLine(line)}
                  >
                    {line.discount
                      ? (line.discount.type === 'percent'
                          ? `${line.discount.value}%`
                          : formatCurrency(line.discount.value))
                      : 'Sin descuento'}
                  </button>
                </div>

                <div className="space-y-1 text-right">
                  <label className="text-[11px] uppercase text-slate-500">Total línea</label>
                  <p className="text-sm font-semibold text-primary-200">{formatCurrency(totals.total)}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>Subtotal</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Descuentos líneas</span>
          <span>-{formatCurrency(totals.lineDiscounts)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <div>
            <p>Descuento global</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <label className="flex items-center gap-1">
                %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cart.globalDiscountPercent}
                  onChange={(event) => setGlobalDiscounts(Number(event.target.value), cart.globalDiscountAmount)}
                  className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 focus:border-primary-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1">
                $
                <input
                  type="number"
                  min={0}
                  value={cart.globalDiscountAmount}
                  onChange={(event) => setGlobalDiscounts(cart.globalDiscountPercent, Number(event.target.value))}
                  className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 focus:border-primary-500 focus:outline-none"
                />
              </label>
            </div>
          </div>
          <span>-{formatCurrency(totals.globalDiscounts)}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>IVA</span>
          <span>{formatCurrency(totals.tax)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={() => setLogisticsOpen(true)}
          >
            Logística ({hotkeys.openLogistics})
          </button>
          <span>{formatCurrency(totals.logisticsCost)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-primary-200">
          <span>Total</span>
          <span>{formatCurrency(totals.total)}</span>
        </div>
      </section>

      <section className="space-y-3 text-sm">
        <textarea
          rows={2}
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
          placeholder="Observaciones"
          value={cart.note ?? ''}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={() => {
              const success = openQuotePrint(cart, totals);
              if (!success) {
                pushToast({
                  tone: 'error',
                  title: 'No se pudo abrir la vista de impresión',
                  description: 'Verifica los permisos del navegador para ventanas emergentes.',
                });
              }
            }}
          >
            Imprimir presupuesto
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={onOpenClients}
          >
            Clientes ({hotkeys.openClients})
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={() => setPaymentsOpen(true)}
          >
            Multipago ({hotkeys.openPayments})
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={() => setSimulatorOpen(true)}
          >
            Simulador ({hotkeys.openSimulator})
          </button>
        </div>
      </section>

      <LineDiscountEditor
        open={!!targetLine}
        onClose={() => setTargetLine(null)}
        initial={targetLine?.discount ?? null}
        onSave={(discount) => {
          if (!targetLine) return;
          setLineDiscount(targetLine.lineId, discount);
        }}
      />

      <LogisticsSelector
        open={isLogisticsOpen}
        onClose={() => setLogisticsOpen(false)}
        initial={cart.logistics}
        onSave={(payload) => setLogistics(payload)}
        stores={stores}
      />

      <Modal
        open={isPaymentsOpen}
        onClose={() => setPaymentsOpen(false)}
        title="Multipago"
        size="md"
      >
        <div className="space-y-3 text-sm text-slate-300">
          <p>Placeholder de multipago. Aquí podrás distribuir montos por medio en próximas iteraciones.</p>
          <p className="text-xs text-slate-500">Hoy podés registrar los pagos manualmente desde el ERP.</p>
        </div>
      </Modal>

      <PaymentSimulatorModal
        open={isSimulatorOpen}
        total={totals.total}
        onClose={() => setSimulatorOpen(false)}
        onApply={(payload) => {
          console.log('Simulador payload', payload);
          markSynced();
        }}
      />
    </aside>
  );
};
