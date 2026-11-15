/**
 * ILARA BEAUTY - UNIFIED PANEL LOGIC (panel.js)
 * High-performance state management, reactive POS cart, WhatsApp order pipeline, and real-time margin ledger.
 */

// Local state for the session
const PanelState = {
  activeWorkspace: 'pos',
  posCart: [],
  selectedCustomer: null,
  selectedPaymentMethod: 'efectivo',
  cashAmountPaid: 0,
  products: [...MOCK_DATA.products],
  orders: [...MOCK_DATA.ordersPipeline],
  customers: [...MOCK_DATA.customers],
  expenses: [...MOCK_DATA.expensesLedger],
  recentSales: [...MOCK_DATA.recentSales],
  stats: { ...MOCK_DATA.storeInfo.cashRegister }
};

// Toast notification helper
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${type === 'success' ? '✨' : type === 'error' ? '⚠️' : '🌸'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --------------------------------------------------------------------------
// 1. WORKSPACE SWITCHER
// --------------------------------------------------------------------------
function switchWorkspace(workspaceId) {
  PanelState.activeWorkspace = workspaceId;

  // Update sidebar active link
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.workspace === workspaceId);
  });

  // Update visible view
  document.querySelectorAll('.workspace-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${workspaceId}`);
  });

  // Workspace-specific renders
  if (workspaceId === 'pos') renderPosGrid();
  if (workspaceId === 'orders') renderOrdersPipeline();
  if (workspaceId === 'inventory') renderInventoryTable();
  if (workspaceId === 'finance') renderFinanceView();
  if (workspaceId === 'customers') renderCustomersView();
}

// --------------------------------------------------------------------------
// 2. POS / PUNTO DE VENTA LOGIC
// --------------------------------------------------------------------------
function renderPosGrid(filterCategory = 'all', searchQuery = '') {
  const grid = document.getElementById('pos-products-grid');
  if (!grid) return;

  let filtered = PanelState.products;
  if (filterCategory !== 'all') {
    filtered = filtered.filter(p => p.category === filterCategory);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }

  grid.innerHTML = filtered.map(p => {
    const isCritical = p.stock <= p.minStock;
    return `
      <div class="pos-product-card" onclick="handlePosCardClick(${p.id})">
        <div class="pos-product-img-wrapper">
          <img src="${p.image}" alt="${p.name}" class="pos-product-img" loading="lazy" />
          <span class="badge ${isCritical ? 'badge-danger' : 'badge-gold'} pos-card-badge">
            ${isCritical ? 'CRÍTICO: ' + p.stock : p.badge || 'STOCK: ' + p.stock}
          </span>
        </div>
        <div class="pos-product-info">
          <div>
            <span style="font-size: 0.68rem; text-transform: uppercase; color: var(--accent-gold-dark); font-weight: 700;">${p.brand}</span>
            <h4 class="pos-product-title">${p.name}</h4>
          </div>
          <div class="pos-product-price-row">
            <span class="pos-price">${formatARS(p.salePrice)}</span>
            <button class="btn btn-primary btn-sm" style="padding: 4px 10px;" onclick="event.stopPropagation(); addToPosCart(${p.id});">
              + Agregar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handlePosCardClick(productId) {
  const p = PanelState.products.find(item => item.id === productId);
  if (!p) return;

  if (p.shades && p.shades.length > 0) {
    openShadeSelectorModal(p);
  } else {
    addToPosCart(p.id);
  }
}

function openShadeSelectorModal(product) {
  const modal = document.getElementById('pos-shade-modal');
  if (!modal) return;

  const content = modal.querySelector('.modal-body-content');
  content.innerHTML = `
    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 16px;">
      <img src="${product.image}" style="width: 70px; height: 70px; border-radius: var(--radius-md); object-fit: cover;" />
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700;">${product.name}</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Seleccioná el tono para añadir al ticket:</p>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${product.shades.map(s => `
        <button class="btn btn-secondary" style="justify-content: space-between; padding: 12px 16px;" onclick="addToPosCart(${product.id}, '${s.name}'); closePosShadeModal();">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="width: 20px; height: 20px; border-radius: 50%; background: ${s.hex}; border: 1px solid var(--border-medium); display: inline-block;"></span>
            <strong>${s.name}</strong>
          </div>
          <span class="badge ${s.stock <= 2 ? 'badge-warning' : 'badge-success'}">Stock: ${s.stock} un.</span>
        </button>
      `).join('')}
    </div>
  `;
  modal.classList.add('active');
}

function closePosShadeModal() {
  const modal = document.getElementById('pos-shade-modal');
  if (modal) modal.classList.remove('active');
}

function addToPosCart(productId, selectedShade = null) {
  const p = PanelState.products.find(item => item.id === productId);
  if (!p) return;

  if (p.stock <= 0) {
    showToast('Sin stock disponible de este producto', 'error');
    return;
  }

  const existing = PanelState.posCart.find(item => item.id === productId && item.shade === selectedShade);
  if (existing) {
    if (existing.qty >= p.stock) {
      showToast(`Stock máximo alcanzado (${p.stock} un.)`, 'warning');
      return;
    }
    existing.qty += 1;
  } else {
    PanelState.posCart.push({
      id: p.id,
      name: p.name,
      price: p.salePrice,
      purchasePrice: p.purchasePrice,
      shade: selectedShade,
      qty: 1,
      image: p.image
    });
  }

  renderPosCart();
  showToast(`${p.name} agregado al ticket`, 'success');
}

function updatePosCartQty(index, delta) {
  const item = PanelState.posCart[index];
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    PanelState.posCart.splice(index, 1);
  }
  renderPosCart();
}

function clearPosCart() {
  PanelState.posCart = [];
  PanelState.selectedCustomer = null;
  PanelState.cashAmountPaid = 0;
  renderPosCart();
}

function renderPosCart() {
  const container = document.getElementById('pos-cart-items');
  const summarySubtotal = document.getElementById('pos-cart-subtotal');
  const summaryDiscount = document.getElementById('pos-cart-discount');
  const summaryTotal = document.getElementById('pos-cart-total');
  const btnCheckout = document.getElementById('btn-pos-checkout');

  if (!container) return;

  if (PanelState.posCart.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; color: var(--text-muted); text-align: center; gap: 8px;">
        <span style="font-size: 2.2rem;">🛍️</span>
        <p style="font-size: 0.88rem; font-weight: 500;">Ticket de venta vacío</p>
        <p style="font-size: 0.75rem;">Haz clic en cualquier producto del catálogo para comenzar a cobrar.</p>
      </div>
    `;
    if (summarySubtotal) summarySubtotal.textContent = formatARS(0);
    if (summaryDiscount) summaryDiscount.textContent = formatARS(0);
    if (summaryTotal) summaryTotal.textContent = formatARS(0);
    if (btnCheckout) btnCheckout.disabled = true;
    updateCashChangeCalculation(0);
    return;
  }

  container.innerHTML = PanelState.posCart.map((item, index) => `
    <div class="pos-cart-item">
      <div class="pos-item-meta">
        <h5 class="pos-item-title">${item.name}</h5>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${item.shade ? `<span class="badge badge-rose" style="font-size: 0.68rem;">${item.shade}</span>` : ''}
          <span class="pos-item-price-unit">${formatARS(item.price)} c/u</span>
        </div>
      </div>
      <div class="pos-qty-controls">
        <button class="pos-qty-btn" onclick="updatePosCartQty(${index}, -1)">-</button>
        <span style="font-weight: 700; font-size: 0.85rem; width: 18px; text-align: center;">${item.qty}</span>
        <button class="pos-qty-btn" onclick="updatePosCartQty(${index}, 1)">+</button>
      </div>
      <div style="font-weight: 700; font-size: 0.9rem; min-width: 70px; text-align: right;">
        ${formatARS(item.price * item.qty)}
      </div>
    </div>
  `).join('');

  // Calculations
  const subtotal = PanelState.posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  // VIP Customer discount or cash promo
  let discount = 0;
  if (PanelState.selectedCustomer && PanelState.selectedCustomer.tier.includes('VIP')) {
    discount = Math.round(subtotal * 0.10); // 10% VIP discount
  } else if (PanelState.selectedPaymentMethod === 'efectivo') {
    discount = Math.round(subtotal * 0.05); // 5% Cash discount
  }

  const finalTotal = subtotal - discount;

  if (summarySubtotal) summarySubtotal.textContent = formatARS(subtotal);
  if (summaryDiscount) summaryDiscount.textContent = discount > 0 ? `-${formatARS(discount)}` : formatARS(0);
  if (summaryTotal) summaryTotal.textContent = formatARS(finalTotal);
  if (btnCheckout) btnCheckout.disabled = false;

  updateCashChangeCalculation(finalTotal);
}

function updateCashChangeCalculation(total) {
  const cashInputRow = document.getElementById('pos-cash-calc-row');
  if (!cashInputRow) return;

  if (PanelState.selectedPaymentMethod === 'efectivo') {
    cashInputRow.style.display = 'flex';
    const input = document.getElementById('pos-cash-received');
    const changeDisplay = document.getElementById('pos-cash-change');
    const received = parseFloat(input ? input.value : 0) || 0;
    const change = Math.max(0, received - total);
    if (changeDisplay) changeDisplay.textContent = formatARS(change);
  } else {
    cashInputRow.style.display = 'none';
  }
}

function handlePaymentMethodSelect(method) {
  PanelState.selectedPaymentMethod = method;
  document.querySelectorAll('.pos-pay-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.method === method);
  });
  renderPosCart();
}

function executePosSale() {
  if (PanelState.posCart.length === 0) return;

  const subtotal = PanelState.posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cost = PanelState.posCart.reduce((sum, item) => sum + (item.purchasePrice * item.qty), 0);
  const discount = (PanelState.selectedPaymentMethod === 'efectivo' || (PanelState.selectedCustomer && PanelState.selectedCustomer.tier.includes('VIP'))) ? Math.round(subtotal * 0.05) : 0;
  const total = subtotal - discount;
  const netMargin = total - cost;

  const saleId = 'VTA-' + (3092 + PanelState.recentSales.length);
  const customerName = PanelState.selectedCustomer ? PanelState.selectedCustomer.name : 'Cliente Mostrador';

  const newSale = {
    id: saleId,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    customer: customerName,
    itemsCount: PanelState.posCart.reduce((s, i) => s + i.qty, 0),
    total: total,
    marginNet: netMargin,
    paymentMethod: PanelState.selectedPaymentMethod,
    items: PanelState.posCart.map(i => `${i.name} (x${i.qty})`).join(', ')
  };

  // Update State
  PanelState.recentSales.unshift(newSale);
  PanelState.stats.todaySalesCount += 1;
  PanelState.stats.todayGrossRevenue += total;
  PanelState.stats.currentBalance += total;

  // Deduct stocks
  PanelState.posCart.forEach(cartItem => {
    const prod = PanelState.products.find(p => p.id === cartItem.id);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - cartItem.qty);
    }
  });

  // Open Receipt Modal
  openReceiptModal(newSale, PanelState.posCart);

  // Clear Cart
  clearPosCart();
  updateTopMetricsTicker();
  showToast(`¡Venta ${saleId} registrada exitosamente! 🎉`, 'success');
}

function openReceiptModal(sale, items) {
  const modal = document.getElementById('pos-receipt-modal');
  if (!modal) return;

  const content = modal.querySelector('.modal-receipt-body');
  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <h3 style="font-family: var(--font-serif); font-size: 1.6rem; letter-spacing: 0.05em; font-weight: 700;">ILARA BEAUTY</h3>
      <p style="font-size: 0.75rem; color: var(--text-muted);">Comprobante Oficial de Venta · ${sale.id}</p>
      <p style="font-size: 0.72rem; color: var(--text-muted);">${new Date().toLocaleDateString('es-AR')} ${sale.time} hs</p>
    </div>
    <div style="border-top: 1px dashed var(--border-medium); border-bottom: 1px dashed var(--border-medium); padding: 12px 0; margin-bottom: 16px; font-size: 0.85rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: var(--text-secondary);">Cliente:</span>
        <strong>${sale.customer}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-secondary);">Método de Pago:</span>
        <strong style="text-transform: capitalize;">${sale.paymentMethod}</strong>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
      ${items.map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
          <span>${item.qty}x ${item.name} ${item.shade ? `(${item.shade})` : ''}</span>
          <strong>${formatARS(item.price * item.qty)}</strong>
        </div>
      `).join('')}
    </div>
    <div style="border-top: 1px solid var(--border-medium); padding-top: 10px; display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; color: var(--accent-rose-dark);">
      <span>TOTAL COBRADO</span>
      <span>${formatARS(sale.total)}</span>
    </div>
  `;

  modal.classList.add('active');
}

function closeReceiptModal() {
  const modal = document.getElementById('pos-receipt-modal');
  if (modal) modal.classList.remove('active');
}

function sendReceiptWhatsApp() {
  showToast('Enlace de comprobante enviado a WhatsApp', 'success');
  closeReceiptModal();
}

// --------------------------------------------------------------------------
// 3. ORDERS & WHATSAPP PIPELINE
// --------------------------------------------------------------------------
function renderOrdersPipeline() {
  const container = document.getElementById('orders-pipeline-board');
  if (!container) return;

  const statuses = [
    { id: 'pending_payment', label: '1. Pendiente de Pago', badge: 'badge-warning' },
    { id: 'packing', label: '2. En Preparación', badge: 'badge-rose' },
    { id: 'ready', label: '3. Listo para Despacho / Retiro', badge: 'badge-success' }
  ];

  container.innerHTML = statuses.map(col => {
    const colOrders = PanelState.orders.filter(o => o.status === col.id);
    return `
      <div class="pipeline-col">
        <div class="pipeline-col-header">
          <span>${col.label}</span>
          <span class="badge ${col.badge}">${colOrders.length}</span>
        </div>
        <div class="pipeline-cards-container">
          ${colOrders.map(order => `
            <div class="order-kanban-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <strong style="font-size: 0.95rem;">${order.customer}</strong>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${order.id} · ${order.date}</div>
                </div>
                <span class="badge badge-gold" style="font-size: 0.68rem;">${order.channel}</span>
              </div>
              
              <div style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-surface); padding: 8px; border-radius: var(--radius-sm);">
                ${order.items.map(i => `<div>• ${i.qty}x ${i.name}</div>`).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                <span style="color: var(--text-muted); font-size: 0.75rem;">${order.deliveryMethod}</span>
                <strong style="color: var(--accent-rose-dark); font-size: 1rem;">${formatARS(order.total)}</strong>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button class="btn btn-whatsapp btn-sm" style="flex: 1;" onclick="openWhatsAppForOrder('${order.id}')">
                  💬 Avisar por WhatsApp
                </button>
                <button class="btn btn-secondary btn-sm" title="Avanzar estado" onclick="advanceOrderStatus('${order.id}')">
                  ➡️
                </button>
              </div>
            </div>
          `).join('')}
          ${colOrders.length === 0 ? `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.8rem;">No hay pedidos en esta etapa</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function advanceOrderStatus(orderId) {
  const order = PanelState.orders.find(o => o.id === orderId);
  if (!order) return;

  if (order.status === 'pending_payment') {
    order.status = 'packing';
    order.statusLabel = 'En Preparación';
    showToast(`Pedido ${orderId} marcado como EN PREPARACIÓN`, 'info');
  } else if (order.status === 'packing') {
    order.status = 'ready';
    order.statusLabel = 'Listo para Despacho';
    showToast(`Pedido ${orderId} LISTO PARA RETIRO/DESPACHO`, 'success');
  } else if (order.status === 'ready') {
    showToast(`Pedido ${orderId} finalizado y entregado`, 'success');
    PanelState.orders = PanelState.orders.filter(o => o.id !== orderId);
  }

  renderOrdersPipeline();
}

function openWhatsAppForOrder(orderId) {
  const order = PanelState.orders.find(o => o.id === orderId);
  if (!order) return;

  const url = `https://wa.me/${order.phone}?text=${encodeURIComponent(order.whatsappTemplate)}`;
  window.open(url, '_blank');
  showToast('Abriendo chat de WhatsApp con plantilla personalizada...', 'success');
}

// --------------------------------------------------------------------------
// 4. REAL MARGIN & FINANCIAL LEDGER
// --------------------------------------------------------------------------
function renderFinanceView() {
  const container = document.getElementById('view-finance');
  if (!container) return;

  const grossSales = PanelState.stats.todayGrossRevenue;
  const cogs = Math.round(grossSales * 0.42); // estimated cost of goods
  const totalExpenses = PanelState.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossSales - cogs - totalExpenses;
  const netMarginPct = grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(1) : 0;

  document.getElementById('fin-gross-sales').textContent = formatARS(grossSales);
  document.getElementById('fin-cogs').textContent = formatARS(cogs);
  document.getElementById('fin-expenses').textContent = formatARS(totalExpenses);
  document.getElementById('fin-net-profit').textContent = formatARS(netProfit);
  document.getElementById('fin-margin-pct').textContent = `${netMarginPct}%`;

  // Render expenses table
  const expensesTableBody = document.getElementById('finance-expenses-tbody');
  if (expensesTableBody) {
    expensesTableBody.innerHTML = PanelState.expenses.map(e => `
      <tr>
        <td><strong>${e.id}</strong></td>
        <td>${e.date}</td>
        <td><span class="badge badge-rose">${e.categoryLabel}</span></td>
        <td>${e.description}</td>
        <td style="text-transform: capitalize;">${e.paymentMethod}</td>
        <td style="font-weight: 700; color: var(--danger); text-align: right;">-${formatARS(e.amount)}</td>
      </tr>
    `).join('');
  }
}

function openAddExpenseModal() {
  const modal = document.getElementById('modal-add-expense');
  if (modal) modal.classList.add('active');
}

function closeAddExpenseModal() {
  const modal = document.getElementById('modal-add-expense');
  if (modal) modal.classList.remove('active');
}

function handleSaveExpense(e) {
  e.preventDefault();
  const desc = document.getElementById('exp-desc').value;
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  const category = document.getElementById('exp-category').value;
  const method = document.getElementById('exp-method').value;

  if (!desc || amount <= 0) {
    showToast('Por favor completá los campos correctamente', 'warning');
    return;
  }

  const newExpense = {
    id: 'EXP-' + (104 + PanelState.expenses.length),
    date: new Date().toISOString().split('T')[0],
    category: category,
    categoryLabel: category.toUpperCase(),
    description: desc,
    amount: amount,
    paymentMethod: method
  };

  PanelState.expenses.unshift(newExpense);
  closeAddExpenseModal();
  renderFinanceView();
  showToast('Gasto registrado en el libro de caja', 'success');
}

// --------------------------------------------------------------------------
// 5. INVENTORY & SMART STOCK
// --------------------------------------------------------------------------
function renderInventoryTable(filter = 'all') {
  const tbody = document.getElementById('inventory-table-tbody');
  if (!tbody) return;

  let prods = PanelState.products;
  if (filter === 'critical') {
    prods = prods.filter(p => p.stock <= p.minStock);
  }

  tbody.innerHTML = prods.map(p => {
    const isCritical = p.stock <= p.minStock;
    const unitMargin = p.salePrice - p.purchasePrice;
    const marginPct = ((unitMargin / p.salePrice) * 100).toFixed(0);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${p.image}" style="width: 44px; height: 44px; border-radius: var(--radius-md); object-fit: cover;" />
            <div>
              <strong style="font-size: 0.9rem;">${p.name}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${p.sku} · ${p.brand}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-gold">${p.categoryName}</span></td>
        <td style="color: var(--text-muted);">${formatARS(p.purchasePrice)}</td>
        <td style="font-weight: 700; color: var(--text-primary);">${formatARS(p.salePrice)}</td>
        <td>
          <span class="badge badge-success">+${marginPct}% (${formatARS(unitMargin)})</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${isCritical ? 'badge-danger' : 'badge-success'}">
              ${p.stock} un.
            </span>
            ${isCritical ? '<span style="font-size: 0.72rem; color: var(--danger); font-weight: 700;">¡Reponer!</span>' : ''}
          </div>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="showToast('Edición de producto: ${p.sku}', 'info')">
            ✏️ Editar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// 6. CUSTOMERS / CRM
// --------------------------------------------------------------------------
function renderCustomersView() {
  const container = document.getElementById('customers-crm-grid');
  if (!container) return;

  container.innerHTML = PanelState.customers.map(c => `
    <div class="surface-card" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 700;">${c.name}</h4>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${c.phone}</div>
        </div>
        <span class="badge ${c.tier.includes('VIP') ? 'badge-gold' : 'badge-rose'}">${c.tier}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: var(--bg-secondary); padding: 10px; border-radius: var(--radius-md); font-size: 0.8rem;">
        <div>
          <span style="color: var(--text-muted);">LTV Total:</span>
          <div style="font-weight: 700; color: var(--accent-rose-dark);">${formatARS(c.ltv)}</div>
        </div>
        <div>
          <span style="color: var(--text-muted);">Puntos Club:</span>
          <div style="font-weight: 700;">💎 ${c.points} pts</div>
        </div>
        <div style="grid-column: span 2;">
          <span style="color: var(--text-muted);">Tono Favorito:</span>
          <div style="font-weight: 600;">${c.preferredFoundationShade || 'No registrado'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button class="btn btn-whatsapp btn-sm" style="flex: 1;" onclick="showToast('Enviando promo personalizada por WhatsApp a ${c.name}...', 'success')">
          💬 Enviar Promo
        </button>
        <button class="btn btn-secondary btn-sm" onclick="selectCustomerForPos(${c.id})">
          🛒 Cargar en POS
        </button>
      </div>
    </div>
  `).join('');
}

function selectCustomerForPos(customerId) {
  const cust = PanelState.customers.find(c => c.id === customerId);
  if (!cust) return;

  PanelState.selectedCustomer = cust;
  switchWorkspace('pos');
  renderPosCart();
  showToast(`Cliente ${cust.name} asignada al ticket POS`, 'success');
}

// --------------------------------------------------------------------------
// 7. GLOBAL TICKER & EVENT LISTENERS
// --------------------------------------------------------------------------
function updateTopMetricsTicker() {
  const elRev = document.getElementById('metric-today-revenue');
  const elMargin = document.getElementById('metric-net-margin');
  const elOrders = document.getElementById('metric-pending-orders');
  const elCritical = document.getElementById('metric-critical-stock');

  if (elRev) elRev.textContent = formatARS(PanelState.stats.todayGrossRevenue);
  if (elMargin) elMargin.textContent = `${PanelState.stats.todayNetMarginPct}%`;
  if (elOrders) elOrders.textContent = PanelState.orders.length;
  if (elCritical) elCritical.textContent = PanelState.products.filter(p => p.stock <= p.minStock).length;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  renderPosGrid();
  renderPosCart();
  updateTopMetricsTicker();

  // Keyboard shortcut Cmd/Ctrl + K for search
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('pos-search-input');
      if (searchInput) searchInput.focus();
    }
  });
});
