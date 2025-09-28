/*
  Generador de PDF – Presupuesto e Invoice AFIP (A/B/C)

  Ajustes solicitados:
    - Área CLIENTE: "Condición fiscal" DEBAJO del TIF/NIF en la COLUMNA DERECHA (no debajo del nombre). Dirección del cliente en UNA sola línea y después.
    - Dirección de la SUCURSAL en UNA sola línea (truncada si excede el ancho).
    - Totales (Subtotal / Impuestos / Total): layout tabular (2 columnas) con alturas fijas → sin superposición.
    - “Otros Impuestos Indirectos” en su PROPIA línea, DEBAJO de “IVA Contenido”.
    - Cuadro de la letra de factura más pequeño y movido 10px a la izquierda (respecto al ajuste anterior); “Código: 0xx” debajo.
    - QR + Totales anclados sobre el pie de página; si la tabla no entra, se agrega nueva página.
    - Logo más grande manteniendo proporción; pie y número de página 5px más arriba.
*/

(function () {
  // =========================
  // Utilitarios generales
  // =========================
  function showToast(level, message) {
    try { if (typeof toast === 'function') return toast(message); } catch (_) {}
    console[level === 'danger' ? 'error' : 'log'](message);
  }
  function showSpinner() { const s = document.getElementById('spinner'); if (s) s.style.display = 'flex'; }
  function hideSpinner() { const s = document.getElementById('spinner'); if (s) s.style.display = 'none'; }
  async function fetchWithAuth(url, options = {}) {
    const merged = Object.assign({ credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } }, options);
    const resp = await fetch(url, merged);
    if (!resp.ok) { let data; try { data = await resp.json(); } catch { } const msg = (data && data.error) || resp.statusText || 'Error'; throw new Error(msg); }
    try { return await resp.json(); } catch { return {}; }
  }
  function toggleCart() {
    try { const el = document.getElementById('offCarrito'); if (!el) return; const oc = bootstrap.Offcanvas.getOrCreateInstance(el); oc.toggle(); } catch (_) { }
  }

  // =========================
  // Formato y moneda
  // =========================
  function pad(n, size) { n = String(n); while (n.length < size) n = '0' + n; return n; }
  function convertirMonedaANumero(valor) {
    if (valor == null) return 0;
    if (typeof valor === 'number' && isFinite(valor)) return parseFloat(valor.toFixed(2));
    try {
      let s = valor.toString().trim();
      s = s.replace(/\u2212/g, '-').replace(/[^0-9,.\-]/g, '').replace(/(?!^)-/g, '');
      if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
      else if (s.includes(',')) s = s.replace(',', '.');
      const num = parseFloat(s);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(2));
    } catch { return 0; }
  }
  function formatearMoneda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return '0,00';
    return valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // =========================
  // Mapeo AFIP
  // =========================
  function cbteTipoToLetter(cbteTipo) {
    // WSFE: 1=A, 6=B, 11=C
    if (cbteTipo === 1) return 'A';
    if (cbteTipo === 6) return 'B';
    if (cbteTipo === 11) return 'C';
    return '?';
  }
  function cbteTipoToCodigo(cbteTipo) {
    if (cbteTipo === 1) return '001';
    if (cbteTipo === 6) return '006';
    if (cbteTipo === 11) return '011';
    return pad(cbteTipo || 0, 3);
  }
  function formatearNumeroFactura(cbteTipo, ptoVta, secuencia) {
    const letra = cbteTipoToLetter(cbteTipo);
    const pref = letra === 'A' ? 'FVA' : letra === 'B' ? 'FVB' : letra === 'C' ? 'FVC' : 'FV?';
    return `${pref}${pad(ptoVta, 4)}-${pad(secuencia, 8)}`;
  }

  // =========================
  // Texto en letras (AR)
  // =========================
  function numeroALetras(num) {
    function u(n) { return ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE'][n] || ''; }
    function d(n) {
      if (n < 10) return u(n);
      if (n < 20) return ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE'][n - 10];
      const d = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
      const t = Math.floor(n / 10), r = n % 10;
      if (n >= 20 && n < 30) return r ? `VEINTI${u(r).toLowerCase()}` : 'VEINTE';
      return r ? `${d[t]} Y ${u(r)}` : d[t];
    }
    function c(n) {
      if (n < 100) return d(n);
      const h = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
      if (n === 100) return 'CIEN';
      const t = Math.floor(n / 100), r = n % 100;
      return r ? `${h[t]} ${d(r)}` : h[t];
    }
    function miles(n) {
      const m = Math.floor(n / 1000), r = n % 1000;
      const mt = m === 0 ? '' : (m === 1 ? 'MIL' : `${c(m)} MIL`);
      return [mt, c(r)].filter(Boolean).join(' ').trim();
    }
    function millones(n) {
      const mm = Math.floor(n / 1e6), r = n % 1e6;
      const mt = mm === 0 ? '' : (mm === 1 ? 'UN MILLON' : `${miles(mm)} MILLONES`);
      return [mt, miles(r)].filter(Boolean).join(' ').trim();
    }
    const entero = Math.floor(Math.abs(num));
    const dec = Math.round((Math.abs(num) - entero) * 100);
    const letras = entero === 0 ? 'CERO' : millones(entero);
    return `${letras} PESOS CON ${pad(dec, 2)}/100`;
  }

  // =========================
  // QR AFIP
  // =========================
  function buildAfipQrUrl({ cuit, ptoVta, tipoCmp, nroCmp, importe, moneda = 'PES', ctz = 1, tipoDocRec = 99, nroDocRec = 0, fecha, cae }) {
    try {
      const ver = 1;
      const data = { ver, fecha, cuit, ptoVta: Number(ptoVta), tipoCmp: Number(tipoCmp), nroCmp: Number(nroCmp), importe: Number((+importe || 0).toFixed(2)), moneda, ctz, tipoDocRec: Number(tipoDocRec), nroDocRec: Number(nroDocRec), tipoCodAut: 'E', codAut: cae };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
    } catch (e) { console.warn('No se pudo construir QR AFIP', e); return ''; }
  }

  // =========================
  // POS: preparar carrito
  // =========================
  function prepareCartMapping() {
    const sc = (typeof state !== 'undefined' && state?.carrito)
      ? state.carrito
      : ((window.state && window.state.carrito) ? window.state.carrito : { items: [], cliente: null });
    const items = (sc.items || []).map(it => ({
      productId: it.id || it.productId || it.sku || '',
      productName: it.nombre || it.descripcion || '',
      quantity: Number(it.cantidad || it.quantity || 1),
      unidadMedida: it.unidad || it.unidad_medida || 'un',
      price: Number(it.precio || it.price || 0),
      precioLista: Number(it.precioLista || it.precio || it.price || 0),
    })).filter(it => it.productId);
    const client = sc.cliente || null;
    const obs = (document.getElementById('cartObservationsRetail')?.value || sc.observaciones || '') + '';

    // Normaliza storeFilter
    let storeInput = document.getElementById('storeFilter');
    if (!storeInput) {
      const sel = document.getElementById('storeFilterRetail');
      if (sel) {
        storeInput = document.createElement('input');
        storeInput.type = 'hidden';
        storeInput.id = 'storeFilter';
        storeInput.value = sel.value || '';
        document.body.appendChild(storeInput);
      }
    }
    window.cart = { items, client };
    window.cartObservations = obs;
    return { items, client, obs };
  }

  // =========================
  // Presupuesto POS (simple)
  // =========================
  window.lastQuotationNumber = window.lastQuotationNumber || null;
  window.generatePDF = function () {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) { showToast('danger', 'Error: jsPDF no está cargado'); return reject(new Error('jsPDF no está definido')); }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Constantes de layout
        const PAGE_W = doc.internal.pageSize.getWidth();
        const PAGE_H = doc.internal.pageSize.getHeight();
        const MARGIN_X = 10;
        const FOOTER_H = 18;

        doc.setFont('helvetica', 'normal');

        const nowTxt = new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        const expiry = new Date(); expiry.setDate(expiry.getDate() + 1);
        const vtoTxt = expiry.toLocaleDateString('es-AR');

        prepareCartMapping();
        const storeId = document.getElementById('storeFilter')?.value || 'BA001GC';
        const cartItems = (window.cart?.items || []).map(x => ({ ...x }));
        const cartClient = window.cart?.client ? { ...window.cart.client } : null;

        // Helpers de pie
        const addFooterImg = async () => {
          try {
            await new Promise(res => {
              const img = new Image(); img.crossOrigin = 'anonymous';
              img.onload = () => {
                const w = PAGE_W - 2 * MARGIN_X;
                const h = (img.height * w) / img.width;
                const y = PAGE_H - h - 11; // 5px MÁS ARRIBA
                doc.addImage(img, 'PNG', MARGIN_X, y, w, h);
                res();
              };
              img.onerror = () => res();
              img.src = '/static/img/pie.png';
            });
          } catch { }
        };
        const checkPage = (y, need) => { if (y + need > PAGE_H - FOOTER_H - 11) { doc.addPage(); return 12; } return y; };
        const addLines = (text, x, y, maxW) => {
          const lines = doc.splitTextToSize(text, maxW || (PAGE_W - x - MARGIN_X));
          const lh = 4.5;
          lines.forEach(line => { y = checkPage(y, lh); doc.text(line, x, y); y += lh; });
          return y;
        };

        (async () => {
          // Logo (más grande y manteniendo proporción)
          try {
            await new Promise(res => {
              const img = new Image(); img.crossOrigin = 'anonymous';
              img.onload = () => {
                const logoW = 50;
                const logoH = (img.height / img.width) * logoW;
                doc.addImage(img, 'PNG', PAGE_W - (logoW + 5), 10, logoW, logoH);
                res();
              };
              img.onerror = () => res();
              img.src = '/static/img/logo_0.png';
            });
          } catch { }

          await addFooterImg();

          let y = 16;
          doc.setFontSize(16);
          doc.text('Presupuesto', MARGIN_X, y);
          y += 8;

          doc.setFontSize(9);
          if (window.lastQuotationNumber) { doc.text(`Presupuesto N°: ${window.lastQuotationNumber}`, MARGIN_X, y); y += 5; }
          doc.text(`Fecha y Hora: ${nowTxt}`, MARGIN_X, y); y += 5;
          doc.text(`Válido hasta: ${vtoTxt}`, MARGIN_X, y); y += 8;

          // Dirección sucursal (UNA sola línea)
          try {
            const r = await fetch(`/api/datos_tienda/${storeId}`);
            if (r.ok) {
              const d = await r.json();
              const dir = (d.direccion_completa_unidad_operativa || 'Dirección no disponible') + '';
              const oneLine = dir.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
              const line = doc.splitTextToSize(oneLine, PAGE_W - 2 * MARGIN_X)[0];
              y = addLines(line, MARGIN_X, y, PAGE_W - 2 * MARGIN_X);
            }
          } catch { }

          y += 3;
          doc.setFontSize(10); doc.text('Preparado para', MARGIN_X, y); y += 5;
          doc.setFontSize(9);
          const clienteNombre = cartClient?.nombre_cliente || cartClient?.nombre || 'Consumidor Final';
          const clienteId = (cartClient?.numero_cliente || cartClient?.id || '').toString().trim();
          const clienteIva = cartClient?.tipo_contribuyente || 'Consumidor Final';
          y = addLines((clienteId ? `${clienteId} - ` : '') + clienteNombre, MARGIN_X, y);
          y = addLines(`Cond. IVA: ${clienteIva}`, MARGIN_X, y);
          y += 2;

          // Ítems compactos
          const COLS = { cod: 25, desc: 60, cant: 18, um: 14, pl: 22, pd: 24, imp: 24 };
          const x0 = MARGIN_X;
          doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          doc.text('Código', x0, y);
          doc.text('Descripción', x0 + COLS.cod, y);
          doc.text('Cant', x0 + COLS.cod + COLS.desc, y);
          doc.text('U.M', x0 + COLS.cod + COLS.desc + COLS.cant, y);
          doc.text('P. Lista', x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um, y);
          doc.text('P. Desc', x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um + COLS.pl, y);
          doc.text('Importe', x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um + COLS.pl + COLS.pd, y);
          y += 4; doc.setFont('helvetica', 'normal');

          const maxWDesc = COLS.desc - 2;
          const lineH = 4.2;

          for (const item of cartItems) {
            const precioLista = convertirMonedaANumero(item.precioLista) || 0;
            const precioDesc = convertirMonedaANumero(item.price) || 0;
            const qty = parseFloat(item.quantity) || 1;
            const total = precioDesc * qty;

            const descLines = doc.splitTextToSize(item.productName || 'Producto', maxWDesc);
            const rowH = Math.max(lineH, descLines.length * lineH);

            if (y + rowH > (PAGE_H - 26)) {
              doc.addPage();
              y = 16;
              doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
              doc.text('Código', x0, y);
              doc.text('Descripción', x0 + COLS.cod, y);
              doc.text('Cant', x0 + COLS.cod + COLS.desc, y);
              doc.text('U.M', x0 + COLS.cod + COLS.desc + COLS.cant, y);
              doc.text('P. Lista', x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um, y);
              doc.text('P. Desc', x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um + COLS.pl, y);
              doc.text('Importe', x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um + COLS.pl + COLS.pd, y);
              y += 4; doc.setFont('helvetica', 'normal');
            }

            doc.setFontSize(8);
            doc.text(String(item.productId || 'N/A'), x0, y);
            let dy = y;
            descLines.forEach(line => { doc.text(line, x0 + COLS.cod, dy); dy += lineH; });
            doc.text(qty.toFixed(2).replace('.', ','), x0 + COLS.cod + COLS.desc, y);
            doc.text(item.unidadMedida || 'un', x0 + COLS.cod + COLS.desc + COLS.cant, y);
            doc.text(`$${formatearMoneda(precioLista)}`, x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um, y);
            doc.text(`$${formatearMoneda(precioDesc)}`, x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um + COLS.pl, y);
            doc.text(`$${formatearMoneda(total)}`, x0 + COLS.cod + COLS.desc + COLS.cant + COLS.um + COLS.pl + COLS.pd, y);

            y += rowH + 1.5;
          }

          // Imprimir
          const blob = doc.output('blob'); const url = URL.createObjectURL(blob); const w = window.open(url);
          if (w) {
            w.onload = () => { w.print(); w.onfocus = () => { setTimeout(() => { URL.revokeObjectURL(url); try { w.close(); } catch (_) { } }, 0); }; };
          }
          resolve();
        })().catch(err => { console.error('generatePDF error', err); showToast('danger', `Error al generar el PDF: ${err.message}`); reject(err); });
      } catch (err) { reject(err); }
    });
  };

  // =========================
  // Factura AFIP (A/B/C)
  // =========================
  window.generateInvoicePDF = async function (opts) {
    if (!opts || typeof opts !== 'object') throw new Error('Opciones de PDF no válidas');
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) { showToast('danger', 'Error: jsPDF no está cargado'); throw new Error('jsPDF no está definido'); }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Layout base
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN_X = 15;
    const LINE = y => doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);

    // Pie y reservas
    const FOOTER_IMG_H = 32;
    const FOOTER_MARGIN = 13; // 5px más arriba
    const TOTALS_BLOCK_H = 58; // más alto para acomodar "Otros Impuestos..."
    const CONTENT_BOTTOM = (PAGE_H - FOOTER_IMG_H - FOOTER_MARGIN - TOTALS_BLOCK_H);
    const CONTENT_BOTTOM_INTERMEDIATE = PAGE_H - FOOTER_IMG_H - FOOTER_MARGIN;

    // Tipografías
    const FONT = { base: 'helvetica', h1: 14, h2: 11, h3: 10, text: 9, small: 8, micro: 7 };
    doc.setFont(FONT.base, 'normal');

    // Datos
    const resultado = opts.resultado || {};
    const afipData = opts.afip || {};
    const totales = opts.totales || { subtotal: 0, impuestos: 0, total: 0 };
    const cliente = opts.cliente || {};
    const itemsData = opts.items || [];
    const pagosData = opts.pagos || [];

    const cbteTipo = afipData?.wsfev1?.FeCabReq?.CbteTipo || 6;
    const letra = cbteTipoToLetter(cbteTipo);
    const codigoTipo = cbteTipoToCodigo(cbteTipo);
    const ptoVta = afipData?.wsfev1?.FeCabReq?.PtoVta || 1;
    const secuencia = resultado.cbte_nro || 0;
    const nroFacturaFmt = formatearNumeroFactura(cbteTipo, ptoVta, secuencia);

    const storeId = opts?.storeId || (document.getElementById('storeFilter')?.value || document.getElementById('storeFilterRetail')?.value || 'BA001GC');
    let tienda = {};
    try { const r = await fetch(`/api/datos_tienda/${storeId}`); if (r.ok) tienda = await r.json(); } catch { }
    const sucursal = (tienda?.nombre_tienda || 'Sucursal') + '';
    const dirSucursalRaw = (tienda?.direccion_completa_unidad_operativa || 'Dirección de la sucursal') + '';
    const dirSucursalOne = dirSucursalRaw.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim(); // UNA línea
    const dirSucursalLine = (function () {
      const tempDoc = doc;
      return tempDoc.splitTextToSize(dirSucursalOne, PAGE_W - 2 * MARGIN_X)[0];
    })();
    const localidad = (tienda?.localidad || '').toString();

    // Empresa
    const company = {
      razon_social: 'Unimaco S.A.',
      condicion_fiscal: 'RESPONSABLE INSCRIPTO',
      cuit: '30708992301',
      iibb: '30708992301',
      inicio_actividades: '01/09/2004',
    };

    const fecha = new Date();
    const fechaCbte = afipData?.wsfev1?.FeDetReq?.[0]?.CbteFch || `${fecha.getFullYear()}${pad(fecha.getMonth() + 1, 2)}${pad(fecha.getDate(), 2)}`;
    const fechaFmt = `${fechaCbte.substring(6, 8)}/${fechaCbte.substring(4, 6)}/${fechaCbte.substring(0, 4)}`;
    const docTipo = afipData?.wsfev1?.FeDetReq?.[0]?.DocTipo || 96; // 96=DNI, 80=CUIT, 99=CF
    const docNro = afipData?.wsfev1?.FeDetReq?.[0]?.DocNro || '0';
    const docTxt = docTipo === 80 ? 'CUIT' : (docTipo === 96 ? 'DNI' : 'SD');

    // --- Utilidades de pie ---
    async function drawFooterImage(pageNumber) {
      try {
        await new Promise(res => {
          const img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = () => {
            const w = PAGE_W - 2 * MARGIN_X;
            const h = FOOTER_IMG_H;
            const y = PAGE_H - h - FOOTER_MARGIN;
            doc.setPage(pageNumber);
            doc.addImage(img, 'PNG', MARGIN_X, y, w, h);
            res();
          };
          img.onerror = () => res();
          img.src = '/static/img/pie.png';
        });
      } catch { }
    }

    // --- CABECERA ---
    let y = 16;

    // Logo (más grande, mantiene proporción)
    try {
      await new Promise(res => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          const logoW = 52; const logoH = (img.height / img.width) * logoW;
          doc.addImage(img, 'PNG', MARGIN_X, y - 6, logoW, logoH);
          res();
        };
        img.onerror = () => res();
        img.src = '/static/img/logo_0.png';
      });
    } catch { }

    // Cuadro del tipo: pequeño y 10px más a la izquierda
    const boxW = 12, boxH = 16, boxX = (MARGIN_X + 60), boxY = y - 6;
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(boxX, boxY, boxW, boxH);
    doc.setFont(FONT.base, 'bold'); doc.setFontSize(14);
    doc.text(letra, boxX + boxW / 2, boxY + 10.5, { align: 'center' });
    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.micro);
    doc.text(`Código: ${codigoTipo}`, boxX + boxW / 2, boxY + boxH + 4.2, { align: 'center' });

    // Bloque derecha: “Factura” + numeración + datos
    const rightX = PAGE_W - MARGIN_X - 70;
    doc.setFontSize(FONT.h2); doc.setFont(FONT.base, 'bold');
    doc.text('Factura', rightX, y, { align: 'left' });
    doc.text(nroFacturaFmt.replace(/^FV./, ''), PAGE_W - MARGIN_X, y, { align: 'right' });
    y += 6;

    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.text);
    [['Fecha:', fechaFmt], ['C.U.I.T.:', company.cuit], ['Ingresos Brutos:', company.iibb], ['Inicio de actividades:', company.inicio_actividades]]
      .forEach(([k, v]) => { doc.text(k, rightX, y); doc.text(String(v || ''), PAGE_W - MARGIN_X, y, { align: 'right' }); y += 5; });

    y += 2; LINE(y); y += 6;

    // Datos empresa (sucursal + dirección en UNA línea)
    doc.setFont(FONT.base, 'bold'); doc.setFontSize(FONT.h2);
    doc.text(company.razon_social, MARGIN_X, y); y += 6;

    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.text);
    doc.text(`Sucursal: ${sucursal}`, MARGIN_X, y); y += 4;
    doc.text(dirSucursalLine, MARGIN_X, y); y += 4;
    if (localidad.trim()) { doc.text(localidad, MARGIN_X, y); y += 4; }

    // RESPONSABLE INSCRIPTO (EMPRESA)
    doc.setFont(FONT.base, 'bold'); doc.setFontSize(FONT.h3);
    doc.text(company.condicion_fiscal, MARGIN_X, y); y += 6;

    LINE(y); y += 6;

    // --- CLIENTE ---
    doc.setFont(FONT.base, 'bold'); doc.setFontSize(FONT.h3);
    doc.text('Cliente', MARGIN_X, y); y += 6;

    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.text);

    // Línea 1: ID + Nombre (izquierda) y TIF/NIF (derecha)
    const clienteId = (cliente.numero_cliente || cliente.id || '').toString().trim();
    const clienteNombre = (cliente.nombre || cliente.nombre_cliente || 'Consumidor Final').toString().trim();
    const yLine1 = y;
    doc.text((clienteId ? `${clienteId} - ` : '') + clienteNombre, MARGIN_X, yLine1);
    doc.text(`${docTxt}: ${docNro}`, PAGE_W - MARGIN_X, yLine1, { align: 'right' });

    // Línea 2 (derecha): Condición fiscal DEBAJO del TIF/NIF
    doc.text(`Condición fiscal: ${(cliente.tipo_contribuyente || 'Consumidor Final') + ''}`, PAGE_W - MARGIN_X, yLine1 + 5, { align: 'right' });

    // Avanza el cursor global por debajo de esa segunda línea derecha
    y = yLine1 + 10;

    // Línea 3 (izquierda): Dirección cliente en UNA sola línea (sin título)
    const rawDireccion = (cliente.direccion_completa || cliente.direccion || '').toString();
    const dirClienteOne = rawDireccion.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (dirClienteOne) {
      const dirLine = doc.splitTextToSize(dirClienteOne, PAGE_W - 2 * MARGIN_X)[0];
      doc.text(dirLine, MARGIN_X, y);
      y += 6;
    } else {
      y += 1;
    }

    LINE(y); y += 4;

    // --- TABLA COMPACTA DE ITEMS (sin autoTable) ---
    const COLS = { cant: 18, desc: 90, punit: 26, pdesc: 20, imp: 25 };
    const x0 = MARGIN_X;
    const drawHeader = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(FONT.text);
      doc.text('CANT.', x0, y);
      doc.text('DESCRIPCIÓN', x0 + COLS.cant, y);
      doc.text('P.UNI', x0 + COLS.cant + COLS.desc, y);
      doc.text('%DESC.', x0 + COLS.cant + COLS.desc + COLS.punit, y);
      doc.text('IMPORTE', x0 + COLS.cant + COLS.desc + COLS.punit + COLS.pdesc, y);
      y += 4; doc.setFont('helvetica', 'normal');
    };
    drawHeader();

    const lineH = 4.0;
    const maxWDesc = COLS.desc - 2;
    function needNewPage(remainingRowH, isLastPage) {
      const limit = isLastPage ? CONTENT_BOTTOM : CONTENT_BOTTOM_INTERMEDIATE;
      return (y + remainingRowH) > limit;
    }

    for (let i = 0; i < itemsData.length; i++) {
      const it0 = itemsData[i];
      const it = {
        descripcion: it0.nombre || it0.productName || '',
        cantidad: Number(it0.cantidad || it0.quantity || 1),
        unidad: it0.unidad || it0.unidadMedida || 'un',
        precio: Number(it0.precio || it0.price || 0),
        precioLista: Number(it0.precioLista || it0.precio || it0.price || 0),
      };
      const descPct = it.precioLista > 0 ? (1 - (it.precio / it.precioLista)) * 100 : 0;
      const importe = it.precio * it.cantidad;

      const descLines = doc.splitTextToSize(it.descripcion, maxWDesc);
      const rowH = Math.max(lineH, descLines.length * lineH);
      const isLastItem = (i === itemsData.length - 1);

      if (needNewPage(rowH, isLastItem)) {
        await drawFooterImage(doc.internal.getNumberOfPages());
        doc.addPage();
        y = 16;
        drawHeader();
      }

      doc.setFontSize(FONT.small);
      doc.text(it.cantidad.toFixed(2).replace('.', ','), x0, y);
      let dy = y;
      descLines.forEach(line => { doc.text(line, x0 + COLS.cant, dy); dy += lineH; });
      doc.text(`$${formatearMoneda(it.precio)}`, x0 + COLS.cant + COLS.desc, y);
      doc.text(`${descPct > 0 ? descPct.toFixed(2).replace('.', ',') : '0,00'}%`, x0 + COLS.cant + COLS.desc + COLS.punit, y);
      doc.text(`$${formatearMoneda(importe)}`, x0 + COLS.cant + COLS.desc + COLS.punit + COLS.pdesc, y);

      y += rowH + 1.5;
    }

    // --- ÚLTIMA PÁGINA: Totales + QR SOBRE el pie ---
    const finalPage = doc.internal.getNumberOfPages();
    doc.setPage(finalPage);
    await drawFooterImage(finalPage);

    const blockTopY = PAGE_H - FOOTER_IMG_H - FOOTER_MARGIN - TOTALS_BLOCK_H + 6;

    // QR (derecha)
    const qrSize = 34;
    const qrX = PAGE_W - MARGIN_X - qrSize;
    const qrY = blockTopY + 6;

    const cae = resultado?.cae || '';
    const cae_vto = resultado?.cae_vto || '';
    const fechaAfip = `${fechaCbte.substring(0, 4)}-${fechaCbte.substring(4, 6)}-${fechaCbte.substring(6, 8)}`;
    const qrUrl = buildAfipQrUrl({
      cuit: (company.cuit || '').replace(/\D/g, ''),
      ptoVta,
      tipoCmp: cbteTipo,
      nroCmp: secuencia,
      importe: Number(totales.total || 0),
      tipoDocRec: docTipo,
      nroDocRec: Number(docNro || 0),
      fecha: fechaAfip,
      cae
    });

    if (qrUrl) {
      try {
        await new Promise(res => {
          const img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = () => { doc.addImage(img, 'PNG', qrX, qrY, qrSize, qrSize); res(); };
          img.onerror = () => res();
          img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;
        });
        doc.setFontSize(FONT.micro);
        doc.text('Constatación QR AFIP', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
      } catch { }
    }

    // Bloque izquierdo (en letras + régimen + IVA + Otros)
    let tyLeft = blockTopY + 4;
    const leftMaxW = (qrX - 10) - MARGIN_X;
    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.text);
    const enLetras = numeroALetras(Number(totales.total || 0));
    const letrasLines = doc.splitTextToSize(`Importe en letras: ${enLetras}`, leftMaxW);
    letrasLines.forEach(line => { doc.text(line, MARGIN_X, tyLeft); tyLeft += 5; });

    doc.setFontSize(FONT.small);
    doc.text('Régimen de Transparencia Fiscal al Consumidor Ley 27.743', MARGIN_X, tyLeft); tyLeft += 4;
    doc.text(`IVA Contenido: $${formatearMoneda(Number(totales.impuestos || 0))}`, MARGIN_X, tyLeft); tyLeft += 4;
    doc.text('Otros Impuestos Indirectos: $0,00', MARGIN_X, tyLeft); tyLeft += 4;

    // Bloque de totales (col 2 – derecha)
    const totals = {
      labelX: qrX - 46,      // etiquetas
      amountX: qrX - 6,      // montos
      topY: blockTopY + 6,
      rowH: 7
    };
    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.text);

    let yRow = totals.topY;
    doc.text('Subtotal:', totals.labelX, yRow, { align: 'right' });
    doc.text(`$${formatearMoneda(Number(totales.subtotal || 0))}`, totals.amountX, yRow, { align: 'right' });
    yRow += totals.rowH;

    doc.text('Impuestos (IVA):', totals.labelX, yRow, { align: 'right' });
    doc.text(`$${formatearMoneda(Number(totales.impuestos || 0))}`, totals.amountX, yRow, { align: 'right' });
    yRow += 4;

    doc.setLineWidth(0.3);
    doc.line(totals.amountX - 40, yRow, totals.amountX, yRow);
    yRow += totals.rowH;

    doc.setFont(FONT.base, 'bold'); doc.setFontSize(FONT.h3);
    doc.text('TOTAL:', totals.labelX, yRow, { align: 'right' });
    doc.text(`$${formatearMoneda(Number(totales.total || 0))}`, totals.amountX, yRow, { align: 'right' });
    doc.setFont(FONT.base, 'normal');

    // CAE info (bajo el bloque izquierdo)
    const caeBaseY = blockTopY + TOTALS_BLOCK_H - 12;
    doc.setFont(FONT.base, 'normal'); doc.setFontSize(FONT.text);
    doc.text(`CAE: ${cae || 'N/A'}`, MARGIN_X, caeBaseY);
    doc.text(`Vencimiento CAE: ${cae_vto || 'N/A'}`, MARGIN_X, caeBaseY + 6);

    // Número de páginas (5px más arriba)
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(FONT.small);
      doc.text(`Pág. ${i} / ${pages}`, PAGE_W - MARGIN_X, PAGE_H - 9, { align: 'right' });
      await drawFooterImage(i);
    }

    // Salida
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    try { w?.focus(); } catch (_) { }
  };

  // =========================
  // Flujo de presupuesto POS
  // =========================
  window.generatePdfOnly = async function () {
    const sc = (typeof state !== 'undefined' && state?.carrito)
      ? state.carrito
      : ((window.state && window.state.carrito) ? window.state.carrito : { items: [] });
    if (!sc.items.length) { showToast('danger', 'El carrito está vacío.'); return; }

    prepareCartMapping();
    showSpinner();
    try {
      const idResp = await fetchWithAuth('/api/generate_pdf_quotation_id');
      window.lastQuotationNumber = idResp.quotation_id;
      const storeId = document.getElementById('storeFilter')?.value || 'BA001GC';

      const quotationData = {
        quotation_id: window.lastQuotationNumber,
        type: 'local',
        store_id: storeId,
        client: window.cart.client || null,
        items: (window.cart.items || []),
        observations: (window.cartObservations || ''),
        timestamp: new Date().toISOString()
      };
      await fetchWithAuth('/api/save_local_quotation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quotationData) });

      await window.generatePDF();

      // Limpiar carrito visual
      try {
        sc.items = []; sc.descPorcentaje = 0; sc.descMonto = 0; sc.descMotivo = '';
        if (typeof renderCarrito === 'function') renderCarrito();
        if (typeof renderCatalogo === 'function') renderCatalogo();
        if (typeof save === 'function') save();
      } catch (_) { }

      showToast('success', `PDF generado y presupuesto guardado con ID: ${window.lastQuotationNumber}`);
    } catch (error) {
      console.error('Error al generar PDF o guardar presupuesto:', error);
      showToast('danger', `Error: ${error.message}`);
    } finally { try { toggleCart(); } catch (_) { } hideSpinner(); }
  };
})();
