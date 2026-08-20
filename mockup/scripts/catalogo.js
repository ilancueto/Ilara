/**
 * ILARA BEAUTY - LUXURY DIGITAL CATALOG LOGIC (catalogo.js)
 * High-end shopping experience, real-time cart, shade pickers, coupon engine & WhatsApp checkout.
 */

const StoreState = {
  products: [...MOCK_DATA.products],
  cart: [],
  activeCategory: 'all',
  searchQuery: '',
  selectedSkinType: 'all',
  appliedCoupon: null,
  deliveryMethod: 'envio',
  freeShippingThreshold: 45000,
  deliveryCost: 5500,
  wishlist: new Set(),
  selectedShadesByProduct: {}
};

// --------------------------------------------------------------------------
// 1. RENDER PRODUCTS & GRID
// --------------------------------------------------------------------------
function renderCatalogGrid() {
  const grid = document.getElementById('catalog-grid-container');
  if (!grid) return;

  let filtered = StoreState.products;

  // Filter Category
  if (StoreState.activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === StoreState.activeCategory);
  }

  // Filter Skin Type
  if (StoreState.selectedSkinType !== 'all') {
    filtered = filtered.filter(p => p.skinType.includes(StoreState.selectedSkinType) || p.skinType.includes('Todas') || p.skinType.includes('Todas las pieles'));
  }

  // Search
  if (StoreState.searchQuery.trim()) {
    const q = StoreState.searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">🌸</span>
        <h3 style="font-size: 1.3rem; font-family: var(--font-serif); margin-bottom: 8px;">No encontramos productos con estos filtros</h3>
        <p style="font-size: 0.9rem; margin-bottom: 16px;">Probá seleccionando otra categoría o limpiando la búsqueda.</p>
        <button class="btn btn-secondary" onclick="resetCatalogFilters()">Ver todos los productos</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const selectedShade = StoreState.selectedShadesByProduct[product.id] || (product.shades.length > 0 ? product.shades[0].name : null);
    const isWishlisted = StoreState.wishlist.has(product.id);

    return `
      <div class="product-luxury-card" id="product-card-${product.id}">
        <div class="product-gallery-box">
          <img src="${product.image}" alt="${product.name}" class="product-main-img" id="img-product-${product.id}" loading="lazy" />
          
          <div class="product-top-badge">
            <span class="badge ${product.badge.includes('STOCK') ? 'badge-danger' : 'badge-gold'}">
              ${product.badge}
            </span>
          </div>

          <button class="btn-icon" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); z-index: 3;" onclick="toggleWishlist(${product.id})">
            <span style="color: ${isWishlisted ? 'var(--accent-rose-dark)' : 'var(--text-muted)'}; font-size: 1.1rem;">
              ${isWishlisted ? '❤️' : '🤍'}
            </span>
          </button>

          <div class="product-quick-actions">
            <button class="btn btn-secondary btn-sm" style="flex: 1; background: var(--bg-surface-glass); backdrop-filter: blur(8px);" onclick="openQuickViewModal(${product.id})">
              👁️ Vista Rápida
            </button>
            <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="addToCatalogCart(${product.id})">
              + Agregar
            </button>
          </div>
        </div>

        <div class="product-card-details">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span class="product-brand-tag">${product.brand}</span>
              <div class="product-rating-row">
                <span>⭐ ${product.rating}</span>
                <span style="color: var(--text-muted);">(${product.reviewsCount})</span>
              </div>
            </div>
            <h3 class="product-card-title">${product.name}</h3>
          </div>

          ${product.shades.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 0.72rem; color: var(--text-muted);">Tono: <strong style="color: var(--text-primary);">${selectedShade}</strong></span>
              <div class="swatch-group">
                ${product.shades.map(shade => `
                  <div 
                    class="swatch-item ${selectedShade === shade.name ? 'active' : ''}" 
                    style="background-color: ${shade.hex};" 
                    title="${shade.name}"
                    onclick="selectProductShade(${product.id}, '${shade.name}')"
                  ></div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="product-pricing-box">
            <span class="product-price-current">${formatARS(product.salePrice)}</span>
            ${product.originalPrice ? `<span class="product-price-original">${formatARS(product.originalPrice)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function selectProductShade(productId, shadeName) {
  StoreState.selectedShadesByProduct[productId] = shadeName;
  renderCatalogGrid();
}

function toggleWishlist(productId) {
  if (StoreState.wishlist.has(productId)) {
    StoreState.wishlist.delete(productId);
    showToast('Producto eliminado de tus favoritos', 'info');
  } else {
    StoreState.wishlist.add(productId);
    showToast('¡Guardado en tus favoritos! ❤️', 'success');
  }
  renderCatalogGrid();
}

function filterCatalogCategory(category) {
  StoreState.activeCategory = category;
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.category === category);
  });
  renderCatalogGrid();
}

function filterCatalogSkinType(skinType) {
  StoreState.selectedSkinType = skinType;
  renderCatalogGrid();
}

function resetCatalogFilters() {
  StoreState.activeCategory = 'all';
  StoreState.selectedSkinType = 'all';
  StoreState.searchQuery = '';
  document.querySelectorAll('.cat-pill').forEach(pill => pill.classList.toggle('active', pill.dataset.category === 'all'));
  const searchInput = document.getElementById('store-search-input');
  if (searchInput) searchInput.value = '';
  renderCatalogGrid();
}

// --------------------------------------------------------------------------
// 2. SHOPPING CART & SHIPPING THRESHOLD
// --------------------------------------------------------------------------
function addToCatalogCart(productId, shade = null) {
  const product = StoreState.products.find(p => p.id === productId);
  if (!product) return;

  const chosenShade = shade || StoreState.selectedShadesByProduct[productId] || (product.shades.length > 0 ? product.shades[0].name : null);

  const existingItem = StoreState.cart.find(item => item.id === productId && item.shade === chosenShade);
  if (existingItem) {
    existingItem.qty += 1;
  } else {
    StoreState.cart.push({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.salePrice,
      image: product.image,
      shade: chosenShade,
      qty: 1
    });
  }

  updateCartDrawerUI();
  openCartDrawer();
  showToast(`✨ ${product.name} agregado a tu bolsa`, 'success');
}

function updateCartQty(index, delta) {
  const item = StoreState.cart[index];
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    StoreState.cart.splice(index, 1);
  }
  updateCartDrawerUI();
}

function openCartDrawer() {
  const drawer = document.getElementById('store-cart-drawer');
  const overlay = document.getElementById('store-cart-backdrop');
  if (drawer) drawer.classList.add('active');
  if (overlay) overlay.classList.add('active');
}

function closeCartDrawer() {
  const drawer = document.getElementById('store-cart-drawer');
  const overlay = document.getElementById('store-cart-backdrop');
  if (drawer) drawer.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

function updateCartDrawerUI() {
  const badge = document.getElementById('store-cart-count');
  const totalItemsCount = StoreState.cart.reduce((sum, item) => sum + item.qty, 0);
  if (badge) badge.textContent = totalItemsCount;

  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (StoreState.cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: var(--text-secondary);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">🛍️</span>
        <h4 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 6px;">Tu bolsa de compras está vacía</h4>
        <p style="font-size: 0.85rem; margin-bottom: 20px;">Descubrí nuestras fórmulas de cuidado y maquillaje.</p>
        <button class="btn btn-primary btn-sm" onclick="closeCartDrawer()">Comenzar a comprar</button>
      </div>
    `;
    document.getElementById('cart-footer-details').style.display = 'none';
    return;
  }

  document.getElementById('cart-footer-details').style.display = 'block';

  // Render items
  container.innerHTML = StoreState.cart.map((item, index) => `
    <div class="cart-item-row">
      <img src="${item.image}" alt="${item.name}" class="cart-item-thumbnail" />
      <div class="cart-item-info">
        <h5 class="cart-item-title">${item.name}</h5>
        ${item.shade ? `<span class="cart-item-shade-tag">Tono: ${item.shade}</span>` : ''}
        <div style="font-weight: 700; color: var(--accent-rose-dark); font-size: 0.9rem; margin-top: 2px;">
          ${formatARS(item.price)}
        </div>
      </div>
      <div class="pos-qty-controls">
        <button class="pos-qty-btn" onclick="updateCartQty(${index}, -1)">-</button>
        <span style="font-weight: 700; font-size: 0.85rem; width: 20px; text-align: center;">${item.qty}</span>
        <button class="pos-qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
      </div>
    </div>
  `).join('');

  // Calculations
  const subtotal = StoreState.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  // Free Shipping Progress
  const remainingForFreeShipping = Math.max(0, StoreState.freeShippingThreshold - subtotal);
  const progressPct = Math.min(100, Math.round((subtotal / StoreState.freeShippingThreshold) * 100));

  const progressText = document.getElementById('shipping-progress-text');
  const progressBar = document.getElementById('shipping-progress-fill');

  if (progressText && progressBar) {
    if (remainingForFreeShipping === 0) {
      progressText.innerHTML = `<span>🎉 ¡Felicitaciones! Tenés <strong>ENVÍO GRATIS</strong></span>`;
      progressBar.style.width = '100%';
    } else {
      progressText.innerHTML = `<span>Agregá <strong>${formatARS(remainingForFreeShipping)}</strong> para ENVÍO GRATIS</span> <span>${progressPct}%</span>`;
      progressBar.style.width = `${progressPct}%`;
    }
  }

  // Coupon discount
  let discount = 0;
  if (StoreState.appliedCoupon) {
    discount = Math.round(subtotal * (StoreState.appliedCoupon.discountPercent / 100));
  }

  const shipping = (remainingForFreeShipping === 0 || StoreState.deliveryMethod === 'retiro') ? 0 : StoreState.deliveryCost;
  const grandTotal = subtotal - discount + shipping;

  document.getElementById('cart-summary-subtotal').textContent = formatARS(subtotal);
  document.getElementById('cart-summary-discount').textContent = discount > 0 ? `-${formatARS(discount)}` : formatARS(0);
  document.getElementById('cart-summary-shipping').textContent = shipping === 0 ? '¡GRATIS!' : formatARS(shipping);
  document.getElementById('cart-summary-grand-total').textContent = formatARS(grandTotal);
}

function applyCouponCode() {
  const input = document.getElementById('cart-coupon-input');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  const found = MOCK_DATA.coupons.find(c => c.code === code);

  if (found) {
    StoreState.appliedCoupon = found;
    showToast(`¡Cupón ${found.code} aplicado! (-${found.discountPercent}%) 🎉`, 'success');
  } else {
    showToast('Cupón inválido o expirado', 'error');
  }
  updateCartDrawerUI();
}

function setDeliveryMethod(method) {
  StoreState.deliveryMethod = method;
  document.querySelectorAll('.delivery-pill-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
  updateCartDrawerUI();
}

// --------------------------------------------------------------------------
// 3. WHATSAPP CHECKOUT GENERATOR
// --------------------------------------------------------------------------
function proceedToWhatsAppCheckout() {
  if (StoreState.cart.length === 0) return;

  const subtotal = StoreState.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discount = StoreState.appliedCoupon ? Math.round(subtotal * (StoreState.appliedCoupon.discountPercent / 100)) : 0;
  const remainingForFreeShipping = Math.max(0, StoreState.freeShippingThreshold - subtotal);
  const shipping = (remainingForFreeShipping === 0 || StoreState.deliveryMethod === 'retiro') ? 0 : StoreState.deliveryCost;
  const grandTotal = subtotal - discount + shipping;

  let message = `¡Hola Ilara Beauty! ✨ Deseo realizar el siguiente pedido desde el Catálogo Online:\n\n`;
  message += `🛍️ *PRODUCTOS SELECCIONADOS:*\n`;

  StoreState.cart.forEach(item => {
    message += `• ${item.qty}x ${item.name} ${item.shade ? `[Tono: ${item.shade}]` : ''} - ${formatARS(item.price * item.qty)}\n`;
  });

  message += `\n📦 *MÉTODO DE ENTREGA:* ${StoreState.deliveryMethod === 'retiro' ? 'Retiro en Showroom (Gratis)' : 'Envío a Domicilio'}\n`;
  
  if (StoreState.appliedCoupon) {
    message += `🎟️ *CUPÓN APLICADO:* ${StoreState.appliedCoupon.code} (-${StoreState.appliedCoupon.discountPercent}%)\n`;
  }

  message += `💰 *TOTAL A PAGAR:* ${formatARS(grandTotal)}\n\n`;
  message += `¿Me confirman disponibilidad y los datos para realizar la transferencia? ¡Muchas gracias! 💕`;

  const waUrl = `https://wa.me/${MOCK_DATA.storeInfo.whatsapp}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  showToast('Abriendo WhatsApp con tu pedido preparado...', 'success');
}

// --------------------------------------------------------------------------
// 4. QUICK VIEW MODAL
// --------------------------------------------------------------------------
function openQuickViewModal(productId) {
  const product = StoreState.products.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('product-quickview-modal');
  if (!modal) return;

  const selectedShade = StoreState.selectedShadesByProduct[product.id] || (product.shades.length > 0 ? product.shades[0].name : null);

  const container = modal.querySelector('.quickview-content');
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1.1fr; gap: 24px;">
      <div style="aspect-ratio: 1/1; border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-secondary);">
        <img src="${product.image}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
        <div>
          <span class="badge badge-gold" style="margin-bottom: 8px;">${product.categoryName}</span>
          <h2 style="font-family: var(--font-serif); font-size: 1.8rem; line-height: 1.2; margin-bottom: 6px;">${product.name}</h2>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">Marca: <strong>${product.brand}</strong> · ⭐ ${product.rating} (${product.reviewsCount} opiniones)</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-rose-dark); margin-bottom: 14px;">
            ${formatARS(product.salePrice)}
          </div>
          <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px;">
            ${product.description}
          </p>

          <div style="margin-bottom: 14px;">
            <strong style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent-gold-dark);">Beneficios Clave:</strong>
            <ul style="padding-left: 18px; font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
              ${product.benefits.map(b => `<li>${b}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="addToCatalogCart(${product.id}); closeQuickViewModal();">
            🛍️ Añadir a la Bolsa (${formatARS(product.salePrice)})
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeQuickViewModal() {
  const modal = document.getElementById('product-quickview-modal');
  if (modal) modal.classList.remove('active');
}

// Initialize Catalog
document.addEventListener('DOMContentLoaded', () => {
  renderCatalogGrid();
  updateCartDrawerUI();
});
