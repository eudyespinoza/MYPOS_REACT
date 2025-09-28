import { useMemo, useState } from 'react';
import { clsx } from 'clsx';

interface Props {
  onSearchOrder: (orderNumber: string) => void;
  onSearchQuote: (quoteNumber: string) => void;
}

type TabKey = 'orders' | 'quotes';

const tabs: { key: TabKey; label: string; helper: string; placeholder: string }[] = [
  { key: 'orders', label: 'Pedidos', helper: 'Busca pedidos confirmados para retomarlos rápidamente.', placeholder: 'Número de pedido' },
  { key: 'quotes', label: 'Presupuestos', helper: 'Accede a presupuestos guardados para imprimir o continuar.', placeholder: 'Número de presupuesto' },
];

export const AuxiliarySearchPanels = ({ onSearchOrder, onSearchQuote }: Props) => {
  const [active, setActive] = useState<TabKey>('orders');
  const [value, setValue] = useState('');

  const currentTab = useMemo(() => tabs.find((tab) => tab.key === active) ?? tabs[0], [active]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = value.trim();
    if (!normalized) return;
    if (active === 'orders') {
      onSearchOrder(normalized);
    } else {
      onSearchQuote(normalized);
    }
    setValue('');
  };

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg">
      <header className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={clsx(
              'rounded-full px-4 py-1 text-xs font-semibold transition',
              active === tab.key
                ? 'bg-primary-500 text-white shadow'
                : 'border border-slate-700 text-slate-300 hover:border-primary-400 hover:text-primary-200',
            )}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </header>

      <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">{currentTab.helper}</label>
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={currentTab.placeholder}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary-500 px-4 text-sm font-semibold text-white shadow transition hover:bg-primary-400"
          >
            Buscar
          </button>
        </div>
      </form>

      <p className="mt-3 text-xs text-slate-400">
        Integración pendiente: al buscar se mostrará información detallada en futuras versiones.
      </p>
    </section>
  );
};
