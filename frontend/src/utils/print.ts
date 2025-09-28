import type { CartSnapshot, CartTotals } from '@/types/cart';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const openQuotePrint = (cart: CartSnapshot, totals: CartTotals): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window.open('', 'pos-quote', 'width=900,height=700');
  if (!win) return false;

  const linesHtml = cart.lines
    .map(
      (line) => `
        <tr>
          <td>${line.code}</td>
          <td>${line.name}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${formatCurrency(line.price)}</td>
          <td class="right">${line.discount ? (line.discount.type === 'percent' ? `${line.discount.value}%` : formatCurrency(line.discount.value)) : '—'}</td>
          <td class="right">${formatCurrency(line.price * line.quantity)}</td>
        </tr>
      `,
    )
    .join('');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Presupuesto POS</title>
    <style>
      body { font-family: 'Segoe UI', Roboto, sans-serif; margin: 2rem; color: #0f172a; }
      h1 { margin-bottom: 0.5rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #cbd5f5; padding: 0.5rem; font-size: 0.9rem; }
      th { background: #e0e7ff; text-align: left; }
      .right { text-align: right; }
      .totals { margin-top: 1.5rem; width: 100%; max-width: 20rem; float: right; }
      .totals tr td { border: none; }
      .totals tr:nth-child(odd) { background: rgba(79, 70, 229, 0.05); }
      .meta { font-size: 0.85rem; color: #64748b; margin-top: 0.5rem; }
    </style>
  </head>
  <body>
    <h1>Presupuesto</h1>
    <p class="meta">Fecha: ${new Date().toLocaleString('es-AR')}</p>
    ${cart.client ? `<p class="meta">Cliente: ${cart.client.name}${cart.client.document ? ` · ${cart.client.document}` : ''}</p>` : ''}
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Producto</th>
          <th class="right">Cant.</th>
          <th class="right">Precio</th>
          <th class="right">Descuento</th>
          <th class="right">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml || '<tr><td colspan="6">Sin ítems</td></tr>'}
      </tbody>
    </table>
    <table class="totals">
      <tbody>
        <tr>
          <td>Subtotal</td>
          <td class="right">${formatCurrency(totals.subtotal)}</td>
        </tr>
        <tr>
          <td>Descuentos líneas</td>
          <td class="right">-${formatCurrency(totals.lineDiscounts)}</td>
        </tr>
        <tr>
          <td>Descuento global</td>
          <td class="right">-${formatCurrency(totals.globalDiscounts)}</td>
        </tr>
        <tr>
          <td>IVA</td>
          <td class="right">${formatCurrency(totals.tax)}</td>
        </tr>
        <tr>
          <td>Logística</td>
          <td class="right">${formatCurrency(totals.logisticsCost)}</td>
        </tr>
        <tr>
          <td><strong>Total</strong></td>
          <td class="right"><strong>${formatCurrency(totals.total)}</strong></td>
        </tr>
      </tbody>
    </table>
    ${cart.note ? `<p class="meta">Notas: ${cart.note}</p>` : ''}
    <script>
      setTimeout(() => { window.print(); }, 200);
    </script>
  </body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
};
