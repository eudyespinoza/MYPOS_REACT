
(function (window, document) {
  const existing = window.paymentSimulatorInline;
  if (existing && existing.__initialized) {
    return;
  }

  const SIM_BASE = window.SIMULATOR_INLINE_BASE || '/maestros/simulador';
  const SIM_API_BASE = `${SIM_BASE.replace(/\/$/, '')}/api`;
  const numberFormatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const state = {
    masters: { methods: [], brands: [], banks: [], acquirers: [], vat_rate: '0.21' },
    methodByCode: {},
    brandPlansCache: new Map(),
    plansIndex: new Map(),
    brandBanks: new Map(),
    bankBrands: new Map(),
    brandAcquirers: new Map(),
    planById: new Map(),
    ready: false,
    initPromise: null,
    pendingAmount: null,
    cartAmount: 0,
    lastSimulationPayload: null,
    lastSimulationData: null,
    simulateRequestId: 0,
  };

  const TOAST = typeof window.showToast === 'function' ? window.showToast.bind(window) : null;

  const normalizeKey = value => String(value || '').trim().toLowerCase();

  const formatAmount = value => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) {
      return '0,00';
    }
    return numberFormatter.format(num);
  };

  const formatDecimal = value => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) {
      return '0,00';
    }
    return num.toFixed(2).replace('.', ',');
  };

  const getCsrfToken = () => {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', ...options });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        if (data && data.error) {
          message = data.error;
        }
      } catch (_) {
        // ignore, keep default message
      }
      throw new Error(message);
    }
    return response.json();
  }

  function normTxt(value) {
    try {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (_) {
      return String(value || '').toLowerCase();
    }
  }

  function isCardMethod(code) {
    const method = state.methodByCode[code];
    if (!method) return false;
    const func = normTxt(method.function);
    const name = normTxt(method.name);
    if (func.includes('card')) return true;
    return name.includes('tarjeta') || name.includes('credito') || name.includes('debito');
  }

  function trackPlanIndex(plan) {
    const brandKey = normalizeKey(plan.brand);
    const methodKey = String(plan.method || '');
    const bankKey = String(plan.bank || '');
    const acqKey = String(plan.acquirer || '');

    if (plan.id) {
      state.planById.set(plan.id, plan);
    }

    if (brandKey && methodKey) {
      if (!state.plansIndex.has(brandKey)) {
        state.plansIndex.set(brandKey, new Set());
      }
      state.plansIndex.get(brandKey).add(methodKey);
    }

    if (bankKey && brandKey) {
      if (!state.bankBrands.has(bankKey)) {
        state.bankBrands.set(bankKey, new Set());
      }
      state.bankBrands.get(bankKey).add(brandKey);
    }

    if (brandKey && bankKey) {
      if (!state.brandBanks.has(brandKey)) {
        state.brandBanks.set(brandKey, new Set());
      }
      state.brandBanks.get(brandKey).add(bankKey);
    }

    if (brandKey && acqKey) {
      if (!state.brandAcquirers.has(brandKey)) {
        state.brandAcquirers.set(brandKey, new Set());
      }
      state.brandAcquirers.get(brandKey).add(acqKey);
    }
  }

  function normalizePlan(rawPlan, defaults = {}) {
    return {
      id: rawPlan.id != null ? String(rawPlan.id) : '',
      code: rawPlan.code || '',
      name: rawPlan.name || '',
      fees: rawPlan.fees != null ? Number(rawPlan.fees) : null,
      coef: rawPlan.coef != null ? String(rawPlan.coef) : '',
      method: rawPlan.method != null ? String(rawPlan.method) : (defaults.method || ''),
      brand: rawPlan.brand || defaults.brand || '',
      bank: rawPlan.bank != null ? String(rawPlan.bank) : (defaults.bank || ''),
      acquirer: rawPlan.acquirer != null ? String(rawPlan.acquirer) : (defaults.acquirer || ''),
    };
  }

  async function loadBoot() {
    let data;
    try {
      data = await fetchJson(`${SIM_API_BASE}/boot`);
    } catch (error) {
      console.warn('loadBoot failed, falling back to masters endpoint', error);
      data = await fetchJson(`${SIM_API_BASE}/masters`);
    }

    const masters = data?.masters || data || state.masters;

    state.masters = masters || state.masters;
    state.methodByCode = {};
    (state.masters.methods || []).forEach(method => {
      if (method && method.code) {
        state.methodByCode[String(method.code)] = method;
      }
    });

    const vatRaw = state.masters?.vat_rate;
    if (vatRaw != null) {
      const parsed = parseFloat(vatRaw);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < 1) {
        state.VAT_RATE = parsed;
      }
    }

    state.brandPlansCache = new Map();
    state.plansIndex = new Map();
    state.planById = new Map();
    state.brandBanks = new Map();
    state.bankBrands = new Map();
    state.brandAcquirers = new Map();

    const brandBanks = state.masters?.brand_banks || {};
    Object.entries(brandBanks).forEach(([brand, banks]) => {
      const key = normalizeKey(brand);
      if (!state.brandBanks.has(key)) {
        state.brandBanks.set(key, new Set());
      }
      (banks || []).forEach(b => state.brandBanks.get(key).add(String(b)));
    });

    const bankBrands = state.masters?.bank_brands || {};
    Object.entries(bankBrands).forEach(([bank, brands]) => {
      const bankKey = String(bank);
      if (!state.bankBrands.has(bankKey)) {
        state.bankBrands.set(bankKey, new Set());
      }
      (brands || []).forEach(brand => state.bankBrands.get(bankKey).add(normalizeKey(brand)));
    });

    const brandAcq = state.masters?.brand_acquirers || {};
    Object.entries(brandAcq).forEach(([brand, acquirers]) => {
      const key = normalizeKey(brand);
      if (!state.brandAcquirers.has(key)) {
        state.brandAcquirers.set(key, new Set());
      }
      (acquirers || []).forEach(acq => state.brandAcquirers.get(key).add(String(acq)));
    });

    const plansIndex = data?.plans?.index || {};
    Object.entries(plansIndex).forEach(([brand, methods]) => {
      const brandKey = normalizeKey(brand);
      if (!state.plansIndex.has(brandKey)) {
        state.plansIndex.set(brandKey, new Set());
      }
      Object.entries(methods || {}).forEach(([methodCode, enabled]) => {
        if (enabled) {
          state.plansIndex.get(brandKey).add(String(methodCode));
        }
      });
    });

    const rates = data?.plans?.rates || {};
    Object.values(rates).forEach(rawPlan => {
      const normalized = normalizePlan(rawPlan);
      trackPlanIndex(normalized);
      const brandKey = normalizeKey(normalized.brand);
      if (!brandKey) return;
      if (!state.brandPlansCache.has(brandKey)) {
        state.brandPlansCache.set(brandKey, []);
      }
      state.brandPlansCache.get(brandKey).push(normalized);
    });

    return data;
  }

  function populateMethodOptions(select) {
    if (!select) return;
    const onlyCards = document.getElementById('onlyCards');
    const current = select.value;
    select.innerHTML = '';
    select.appendChild(new Option('-', '', true, false));
    (state.masters.methods || []).forEach(method => {
      if (!method || !method.code) return;
      if (onlyCards && onlyCards.checked && !isCardMethod(method.code)) return;
      select.appendChild(new Option(method.name || method.code, method.code));
    });
    if ([...select.options].some(opt => opt.value === current)) {
      select.value = current;
    }
  }

  function populateSimpleSelect(select, values, getValue, getLabel) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '';
    select.appendChild(new Option('-', '', true, false));
    values.forEach(item => {
      const value = getValue(item);
      const label = getLabel(item);
      select.appendChild(new Option(label, value));
    });
    if ([...select.options].some(opt => opt.value === current)) {
      select.value = current;
    }
  }

  function refillBrands(tr) {
    const select = tr.querySelector('.brand');
    if (!select) return;
    const bankValue = tr.querySelector('.bank')?.value || '';
    const methodValue = tr.querySelector('.method')?.value || '';
    const current = select.value;

    let brands = [...(state.masters.brands || [])];
    if (bankValue && state.bankBrands.has(bankValue)) {
      const allowed = state.bankBrands.get(bankValue);
      brands = brands.filter(brand => allowed.has(normalizeKey(brand)));
    }

    if (methodValue) {
      const filtered = brands.filter(brand => {
        const key = normalizeKey(brand);
        const set = state.plansIndex.get(key);
        if (!set || !set.size) return true;
        return set.has(methodValue);
      });
      if (filtered.length) {
        brands = filtered;
      }
    }

    populateSimpleSelect(select, brands, value => value, value => value);
    if (!select.value && current) {
      select.value = current;
    }
  }

  function refillBanks(tr) {
    const select = tr.querySelector('.bank');
    if (!select) return;
    const brandValue = tr.querySelector('.brand')?.value || '';
    const current = select.value;

    let banks = [...(state.masters.banks || [])];
    if (brandValue) {
      const key = normalizeKey(brandValue);
      const allowed = state.brandBanks.get(key);
      if (allowed && allowed.size) {
        banks = banks.filter(bank => allowed.has(String(bank.code || bank)));
      }
    }

    populateSimpleSelect(select, banks, b => b.code, b => b.name || b.code);
    if (!select.value && current) {
      select.value = current;
    }
  }

  function refillAcquirers(tr) {
    const select = tr.querySelector('.acquirer');
    if (!select) return;
    const brandValue = tr.querySelector('.brand')?.value || '';
    const current = select.value;

    let acquirers = [...(state.masters.acquirers || [])];
    if (brandValue) {
      const key = normalizeKey(brandValue);
      const allowed = state.brandAcquirers.get(key);
      if (allowed && allowed.size) {
        acquirers = acquirers.filter(acq => allowed.has(String(acq.code)));
      }
    }

    populateSimpleSelect(select, acquirers, a => a.code, a => a.name || a.code);
    if (!select.value && current) {
      select.value = current;
    }
  }

  async function getPlansForBrand(brand) {
    const key = normalizeKey(brand);
    if (!key) return [];
    if (state.brandPlansCache.has(key)) {
      return state.brandPlansCache.get(key).map(plan => ({ ...plan }));
    }
    const params = new URLSearchParams({ brand });
    try {
      const data = await fetchJson(`${SIM_API_BASE}/plans?${params.toString()}`);
      const list = Array.isArray(data) ? data : [];
      const normalizedList = list.map(raw => normalizePlan(raw, { brand }));
      normalizedList.forEach(plan => trackPlanIndex(plan));
      state.brandPlansCache.set(key, normalizedList);
      return normalizedList.map(plan => ({ ...plan }));
    } catch (error) {
      console.error('getPlansForBrand error', error);
      if (TOAST) {
        TOAST('danger', 'No se pudieron obtener los planes.');
      }
      return [];
    }
  }

  function renderPlanOptions(select, plans, searchValue = '') {
    if (!select) return;
    const query = normTxt(searchValue);
    select.innerHTML = '';
    select.appendChild(new Option('-', '', true, false));
    const filtered = query
      ? plans.filter(plan => {
          const code = normTxt(plan.code);
          const name = normTxt(plan.name);
          return code.includes(query) || name.includes(query);
        })
      : plans;
    filtered.forEach(plan => {
      select.appendChild(new Option(formatPlanLabel(plan), plan.id));
    });
    const countEl = select.closest('td')?.querySelector('.plan-count');
    if (countEl) {
      countEl.textContent = `${filtered.length} planes`;
    }
    select.disabled = select.options.length <= 1;
    if (!select.disabled && select.options.length === 2) {
      select.selectedIndex = 1;
    }
  }

  async function refreshPlans(tr) {
    const method = tr.querySelector('.method')?.value || '';
    const brand = tr.querySelector('.brand')?.value || '';
    const bank = tr.querySelector('.bank')?.value || '';
    const acquirer = tr.querySelector('.acquirer')?.value || '';
    const planSelect = tr.querySelector('.plan');
    if (!planSelect) return;

    planSelect.innerHTML = '';
    planSelect.appendChild(new Option(brand ? '-' : 'Seleccione marca', '', true, false));
    planSelect.disabled = true;
    if (!brand) return;

    const basePlans = await getPlansForBrand(brand);
    const tasa1 = Boolean(document.getElementById('tasa1')?.checked);

    const filtered = basePlans.filter(plan => {
      if (method && plan.method && plan.method !== method) return false;
      if (bank && plan.bank && plan.bank !== bank) return false;
      if (acquirer && plan.acquirer && plan.acquirer !== acquirer) return false;
      if (tasa1) {
        const coef = String(plan.coef || '').trim();
        if (!['1', '1.0', '1.00', '1,0', '1,00', '1.000'].includes(coef)) return false;
      }
      return true;
    });

    const searchInput = tr.querySelector('.plan-search');
    planSelect.dataset.all = JSON.stringify(filtered);
    renderPlanOptions(planSelect, filtered, searchInput?.value);
  }

  function addLineRow() {
    const tbody = document.getElementById('linesBody');
    if (!tbody) return null;

    const tr = document.createElement('tr');
    tr.innerHTML = [
      '<td>',
      '  <input type="number" step="0.01" class="form-control amount" value="0">',
      '  <div class="small text-muted mt-1 line-badges"></div>',
      '</td>',
      '<td><select class="form-select method"></select></td>',
      '<td><select class="form-select brand"><option value="">-</option></select></td>',
      '<td><select class="form-select bank"><option value="">-</option></select></td>',
      '<td><select class="form-select acquirer"><option value="">-</option></select></td>',
      '<td><select class="form-select plan"><option value="">-</option></select></td>',
      '<td><button type="button" class="btn btn-sm btn-danger rem">X</button></td>',
    ].join('');

    tbody.appendChild(tr);

    const methodSelect = tr.querySelector('.method');
    const brandSelect = tr.querySelector('.brand');
    const bankSelect = tr.querySelector('.bank');
    const acquirerSelect = tr.querySelector('.acquirer');
    const planSelect = tr.querySelector('.plan');
    const amountInput = tr.querySelector('.amount');
    const removeBtn = tr.querySelector('.rem');

    const planCell = planSelect.closest('td');
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'form-control form-control-sm mt-1 plan-search';
    searchInput.placeholder = 'Buscar plan';
    planCell.appendChild(searchInput);
    const planCount = document.createElement('small');
    planCount.className = 'text-muted plan-count';
    planCell.appendChild(planCount);

    populateMethodOptions(methodSelect);
    populateSimpleSelect(brandSelect, state.masters.brands || [], value => value, value => value);
    populateSimpleSelect(bankSelect, state.masters.banks || [], value => value.code, value => value.name || value.code);
    populateSimpleSelect(acquirerSelect, state.masters.acquirers || [], value => value.code, value => value.name || value.code);

    toggleCardFields(tr);
    refillBrands(tr);
    refillBanks(tr);
    refillAcquirers(tr);
    refreshPlans(tr);

    methodSelect?.addEventListener('change', () => {
      toggleCardFields(tr);
      refillBrands(tr);
      refillBanks(tr);
      refillAcquirers(tr);
      refreshPlans(tr);
      simulate();
    });

    brandSelect?.addEventListener('change', () => {
      refillBanks(tr);
      refillAcquirers(tr);
      refreshPlans(tr);
      simulate();
    });

    bankSelect?.addEventListener('change', () => {
      refillBrands(tr);
      refreshPlans(tr);
      simulate();
    });

    acquirerSelect?.addEventListener('change', () => {
      refreshPlans(tr);
      simulate();
    });

    planSelect?.addEventListener('change', () => {
      simulate();
    });

    searchInput.addEventListener('input', () => {
      try {
        const all = JSON.parse(planSelect.dataset.all || '[]');
        renderPlanOptions(planSelect, all, searchInput.value);
      } catch (err) {
        console.error('plan search error', err);
      }
    });

    amountInput?.addEventListener('input', () => {
      simulate();
    });

    removeBtn?.addEventListener('click', () => {
      tr.remove();
      simulate();
    });

    return tr;
  }

  function updateSummaryView(data) {
    const sumLines = document.getElementById('sumLines');
    const discounts = document.getElementById('discounts');
    const base = document.getElementById('base');
    const vat = document.getElementById('vat');
    const interests = document.getElementById('interests');
    const total = document.getElementById('total');
    const badge = document.getElementById('mismatch');
    const confirmBtn = document.getElementById('confirmBtn');

    if (!data) {
      [sumLines, discounts, base, vat, interests, total].forEach(el => {
        if (el) el.textContent = '0,00';
      });
      if (badge) badge.classList.add('d-none');
      if (confirmBtn) confirmBtn.disabled = true;
      renderLineDetails(null);
      return;
    }

    if (sumLines) sumLines.textContent = formatAmount(data.sum_lines);
    if (discounts) discounts.textContent = formatAmount(data.total_discounts);
    if (base) base.textContent = formatAmount(data.base_imponible);
    if (vat) vat.textContent = formatAmount(data.vat);
    if (interests) interests.textContent = formatAmount(data.interests);
    if (total) total.textContent = formatAmount(data.total);

    if (badge) {
      badge.classList.toggle('d-none', !data.warning_mismatch);
    }
    if (confirmBtn) {
      confirmBtn.disabled = Boolean(data.warning_mismatch);
    }
    renderLineDetails(data);
  }

  async function ensureReady() {
    if (state.ready) {
      return true;
    }
    if (state.initPromise) {
      return state.initPromise;
    }
    state.initPromise = (async () => {
      await loadBoot();
      mountEventListeners();
      if (!document.querySelector('#linesBody tr')) {
        addLineRow();
      }
      updateCartLabel(state.cartAmount);
      state.ready = true;
      if (state.pendingAmount != null) {
        setCartAmount(state.pendingAmount);
        state.pendingAmount = null;
      }
      simulate();
      return true;
    })().catch(error => {
      console.error('Simulator init failed', error);
      state.ready = false;
      state.initPromise = null;
      updateConfirmStatus(error.message || 'No se pudo inicializar el simulador', 'error');
      throw error;
    });
    return state.initPromise;
  }

  async function simulate() {
    if (!state.ready) return;
    const payload = buildPayload();
    state.lastSimulationPayload = payload;
    updateConfirmStatus('Simulando...', 'muted');
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    const requestId = ++state.simulateRequestId;
    try {
      const data = await fetchJson(`${SIM_API_BASE}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify(payload),
      });
      if (requestId !== state.simulateRequestId) {
        return;
      }
      state.lastSimulationData = data;
      updateSummaryView(data);
      updateConfirmStatus('');
    } catch (error) {
      if (requestId !== state.simulateRequestId) {
        return;
      }
      state.lastSimulationData = null;
      updateSummaryView(null);
      updateConfirmStatus(error.message || 'Error al simular pagos', 'error');
      if (TOAST) {
        TOAST('danger', 'No se pudo simular los pagos.');
      }
    }
  }

  function handleConfirmClick(event) {
    event?.preventDefault?.();
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn && confirmBtn.disabled) {
      updateConfirmStatus('Asegurate de que las líneas coincidan con el total.', 'error');
      return;
    }
    if (!state.lastSimulationPayload || !state.lastSimulationData) {
      updateConfirmStatus('Primero ejecutá la simulación.', 'error');
      return;
    }
    const envelope = buildSelectionEnvelope();
    if (!envelope) {
      updateConfirmStatus('No hay datos para enviar.', 'error');
      return;
    }
    broadcastSelection(envelope);
    updateConfirmStatus('Detalle enviado al POS.', 'success');
  }

  function handleOnlyCardsChange() {
    const rows = Array.from(document.querySelectorAll('#linesBody tr'));
    rows.forEach(tr => {
      populateMethodOptions(tr.querySelector('.method'));
      toggleCardFields(tr);
      refillBrands(tr);
      refillBanks(tr);
      refillAcquirers(tr);
      refreshPlans(tr);
    });
    simulate();
  }

  function handleTasa1Change() {
    const tasa1 = document.getElementById('tasa1');
    const onlyCards = document.getElementById('onlyCards');
    if (tasa1 && tasa1.checked && onlyCards && !onlyCards.checked) {
      onlyCards.checked = true;
      handleOnlyCardsChange();
      return;
    }
    const rows = Array.from(document.querySelectorAll('#linesBody tr'));
    rows.forEach(tr => refreshPlans(tr));
    simulate();
  }

  function mountEventListeners() {
    document.getElementById('addLine')?.addEventListener('click', event => {
      event.preventDefault();
      addLineRow();
      simulate();
    });

    document.getElementById('confirmBtn')?.addEventListener('click', handleConfirmClick);
    document.getElementById('simulateBtn')?.addEventListener('click', event => {
      event.preventDefault();
      simulate();
    });

    document.getElementById('onlyCards')?.addEventListener('change', handleOnlyCardsChange);
    document.getElementById('tasa1')?.addEventListener('change', handleTasa1Change);

  }

  function buildPayload() {
    const cartAmount = Number.isFinite(state.cartAmount) ? state.cartAmount : 0;
    const tasa1 = Boolean(document.getElementById('tasa1')?.checked);
    const rows = Array.from(document.querySelectorAll('#linesBody tr'));
    const lines = rows.map(tr => ({
      amount: parseFloat(tr.querySelector('.amount')?.value || '0') || 0,
      method_code: tr.querySelector('.method')?.value || '',
      brand: tr.querySelector('.brand')?.value || null,
      bank_code: tr.querySelector('.bank')?.value || null,
      acquirer_code: tr.querySelector('.acquirer')?.value || null,
      plan_id: tr.querySelector('.plan')?.value || null,
    }));
    return { cart_amount: cartAmount, tasa1, lines };
  }

  function updateCartLabel(value) {
    const label = document.getElementById('cartAmountLabel');
    if (label) {
      label.textContent = `$ ${formatAmount(value)}`;
    }
  }

  function setCartAmount(value) {
    const parsed = parseFloat(value || '0');
    const amount = Number.isFinite(parsed) ? parsed : 0;
    state.cartAmount = amount;
    updateCartLabel(amount);
    if (state.ready) {
      state.pendingAmount = null;
      simulate();
    } else {
      state.pendingAmount = amount;
    }
  }

  function toggleCardFields(tr) {
    if (!tr) return;
    const method = tr.querySelector('.method')?.value || '';
    const isCard = isCardMethod(method);
    ['brand', 'bank', 'acquirer', 'plan'].forEach(cls => {
      const select = tr.querySelector(`.${cls}`);
      if (!select) return;
      const cell = select.closest('td');
      if (!cell) return;
      cell.style.display = isCard ? 'table-cell' : 'none';
      select.disabled = !isCard;
    });
  }

  function renderLineDetails(data) {
    const rows = Array.from(document.querySelectorAll('#linesBody tr'));
    const items = Array.isArray(data?.lines) ? data.lines : [];
    rows.forEach((tr, index) => {
      const badge = tr.querySelector('.line-badges');
      if (!badge) return;
      const summaryLine = items[index];
      const payloadLine = state.lastSimulationPayload?.lines?.[index];
      if (!summaryLine || !payloadLine) {
        badge.textContent = '';
        return;
      }
      const parts = [
        `Importe: $ ${formatDecimal(payloadLine.amount)}`,
        summaryLine.discounts_amount ? `Desc $ ${formatDecimal(summaryLine.discounts_amount)}` : null,
        `Neto c/desc $ ${formatDecimal(summaryLine.net_after_discounts)}`,
        summaryLine.vat_line ? `IVA $ ${formatDecimal(summaryLine.vat_line)}` : null,
        `Total $ ${formatDecimal(summaryLine.amount_final)}`,
        summaryLine.coef_applied && Number(summaryLine.coef_applied) !== 1 ? `Coef ${summaryLine.coef_applied}` : null,
      ].filter(Boolean);
      badge.textContent = parts.join(' | ');
    });
  }

  function collectLineSelections(payload, summary) {
    const lines = Array.isArray(payload?.lines) ? payload.lines : [];
    const items = Array.isArray(summary?.lines) ? summary.lines : [];
    return lines.map((line, index) => {
      const summaryLine = items[index] || {};
      const plan = line.plan_id ? state.planById.get(String(line.plan_id)) : null;
      const method = line.method_code ? state.methodByCode[line.method_code] : null;
      return {
        method_code: line.method_code || '',
        method_label: method ? (method.name || method.code || '') : (line.method_code || ''),
        brand: line.brand || '',
        brand_label: line.brand || '',
        bank: line.bank_code || '',
        bank_label: line.bank_code ? (state.masters.banks || []).find(b => String(b.code) === String(line.bank_code))?.name || line.bank_code : '',
        acquirer: line.acquirer_code || '',
        acquirer_label: line.acquirer_code ? (state.masters.acquirers || []).find(a => String(a.code) === String(line.acquirer_code))?.name || line.acquirer_code : '',
        plan_id: line.plan_id || '',
        plan_label: plan ? formatPlanLabel(plan) : '',
        installments: plan && plan.fees != null ? Number(plan.fees) : null,
        coef: plan && plan.coef != null ? Number(plan.coef) : null,
        amount_base: Number(line.amount || 0),
        amount_final: summaryLine.amount_final != null ? Number(summaryLine.amount_final) : null,
        vat_line: summaryLine.vat_line != null ? Number(summaryLine.vat_line) : null,
        discounts_amount: summaryLine.discounts_amount != null ? Number(summaryLine.discounts_amount) : null,
        net_after_discounts: summaryLine.net_after_discounts != null ? Number(summaryLine.net_after_discounts) : null,
        interest_pct: summaryLine.interest_pct != null ? Number(summaryLine.interest_pct) : null,
      };
    });
  }

  function buildSelectionEnvelope() {
    if (!state.lastSimulationPayload || !state.lastSimulationData) {
      return null;
    }
    return {
      type: 'simulator:payment-selection',
      version: '2025-09-17',
      source: 'maestros_simulator_inline',
      cart_amount: Number(state.lastSimulationPayload.cart_amount || 0),
      tasa1: Boolean(state.lastSimulationPayload.tasa1),
      lines: collectLineSelections(state.lastSimulationPayload, state.lastSimulationData),
      totals: {
        subtotal_base: Number(state.lastSimulationData.subtotal_base || state.lastSimulationData.sum_lines || 0),
        total_interest: Number(state.lastSimulationData.total_interest || state.lastSimulationData.interests || 0),
        total_to_charge: Number(state.lastSimulationData.total_to_charge || state.lastSimulationData.total || 0),
        remaining: Number(state.lastSimulationData.remaining || 0),
        change_amount: Number(state.lastSimulationData.change_amount || 0),
      },
      raw: {
        payload: state.lastSimulationPayload,
        response: state.lastSimulationData,
      },
      timestamp: Date.now(),
    };
  }

  function broadcastSelection(envelope) {
    if (!envelope) return;
    try {
      localStorage.setItem('simulator:last-selection', JSON.stringify(envelope));
    } catch (_) {
      // ignore
    }
    const targets = [window.opener, window.parent, window.top].filter(target => target && target !== window);
    targets.forEach(target => {
      try {
        target.postMessage(envelope, '*');
      } catch (error) {
        console.error('postMessage error', error);
      }
    });
    try {
      window.dispatchEvent(new CustomEvent('simulator:payment-selection', { detail: envelope }));
    } catch (error) {
      console.error('CustomEvent dispatch error', error);
    }
  }

  function updateConfirmStatus(message = '', tone = 'success') {
    const el = document.getElementById('confirmStatus');
    if (!el) return;
    el.classList.remove('d-none', 'text-success', 'text-danger', 'text-muted');
    if (!message) {
      el.textContent = '';
      el.classList.add('d-none');
      return;
    }
    const toneClass = tone === 'error' ? 'text-danger' : tone === 'muted' ? 'text-muted' : 'text-success';
    el.classList.add(toneClass);
    el.textContent = message;
  }

  window.paymentSimulatorInline = {
    __initialized: true,
    ensureReady,
    setCartAmount,
  };

  window.setCartAmount = function proxySetCartAmount(value) {
    window.paymentSimulatorInline.setCartAmount(value);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureReady().catch(err => console.error('paymentSimulatorInline init error', err));
    }, { once: true });
  } else {
    ensureReady().catch(err => console.error('paymentSimulatorInline init error', err));
  }

  window.addEventListener('message', event => {
    try {
      const data = event?.data;
      if (data && data.type === 'set_cart_amount') {
        window.paymentSimulatorInline.setCartAmount(data.cart_amount);
      }
    } catch (error) {
      console.error('set_cart_amount message error', error);
    }
  });
})(window, document);
