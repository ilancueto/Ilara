const state = {
  category: 'all',
  query: '',
  cart: [
    {
      product: 'Fijador en spray',
      category: 'Fijación · rostro',
      price: 10000,
      quantity: 1,
      art: 'spray',
    },
  ],
  coupon: null,
}

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const cards = [...document.querySelectorAll('.product-card')]
const tabs = [...document.querySelectorAll('.category-tab')]
const search = document.querySelector('#catalog-search')
const empty = document.querySelector('#empty-state')
const grid = document.querySelector('#product-grid')
const drawer = document.querySelector('#cart-drawer')
const backdrop = document.querySelector('#drawer-backdrop')
const drawerItems = document.querySelector('#drawer-items')
const drawerCountLabel = document.querySelector('#drawer-count-label')
const drawerCoupon = document.querySelector('#drawer-coupon')
const couponForm = document.querySelector('#coupon-form')
const couponCode = document.querySelector('#coupon-code')
const couponApplied = document.querySelector('#coupon-applied')
const summaryDiscount = document.querySelector('#summary-discount')
const toast = document.querySelector('#toast')

function filterProducts() {
  let visible = 0
  cards.forEach((card) => {
    const inCategory = state.category === 'all' || card.dataset.category === state.category
    const inSearch = card.dataset.name.includes(state.query)
    const show = inCategory && inSearch
    card.classList.toggle('hidden', !show)
    if (show) visible += 1
  })
  grid.hidden = visible === 0
  empty.hidden = visible !== 0
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    state.category = tab.dataset.category
    tabs.forEach((item) => item.classList.toggle('active', item === tab))
    filterProducts()
  })
})

search.addEventListener('input', (event) => {
  state.query = event.target.value.toLowerCase().trim()
  filterProducts()
})

document.querySelectorAll('[data-focus-search]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#productos').scrollIntoView({ behavior: 'smooth' })
    window.setTimeout(() => search.focus(), 450)
  })
})

document.querySelectorAll('.favorite').forEach((button) => {
  button.addEventListener('click', () => {
    const active = button.classList.toggle('active')
    button.textContent = active ? '♥' : '♡'
    showToast(active ? 'Guardado en favoritos' : 'Quitado de favoritos')
  })
})

document.querySelectorAll('.quick-add').forEach((button) => {
  button.addEventListener('click', () => {
    const product = button.dataset.product
    const price = Number(button.dataset.price)
    const productCard = button.closest('.product-card')
    const category = productCard?.querySelector('.product-info > span')?.textContent ?? 'Selección Ilara'
    const image = productCard?.querySelector('.product-media img')?.src ?? null
    const existing = state.cart.find((item) => item.product === product)

    if (existing) {
      existing.quantity += 1
    } else {
      state.cart.push({ product, category, price, quantity: 1, image })
    }

    updateCart()
    showToast(`${product} se sumó a tu bolsa`)
  })
})

function getCartSubtotal() {
  return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

function renderProductMedia(item) {
  if (item.image) return `<img src="${item.image}" alt="" />`
  if (item.art === 'spray') return ''
  return `<span class="drawer-product-fallback">ILARA<br>${item.category}</span>`
}

function updateCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = getCartSubtotal()
  const discount = state.coupon ? Math.round(subtotal * 0.1) : 0
  const total = subtotal - discount

  document.querySelectorAll('[data-cart-count]').forEach((node) => { node.textContent = count })
  document.querySelectorAll('[data-cart-total]').forEach((node) => { node.textContent = money.format(total) })
  document.querySelectorAll('[data-cart-subtotal]').forEach((node) => { node.textContent = money.format(subtotal) })
  document.querySelectorAll('[data-cart-discount]').forEach((node) => { node.textContent = `−${money.format(discount)}` })
  drawerCountLabel.textContent = `${count} ${count === 1 ? 'producto' : 'productos'}`
  drawer.classList.toggle('empty', count === 0)

  if (!state.cart.length) {
    state.coupon = null
    couponForm.classList.remove('open')
    drawerCoupon.querySelector('.coupon-toggle').hidden = false
    couponApplied.hidden = true
    summaryDiscount.hidden = true
    drawerItems.innerHTML = `
      <div class="drawer-empty">
        <span>♡</span>
        <strong>Tu bolsa está esperando</strong>
        <p>Volvé al catálogo para encontrar<br>un nuevo favorito.</p>
      </div>
    `
    return
  }

  drawerItems.innerHTML = state.cart.map((item, index) => `
    <article class="drawer-line">
      <div class="drawer-product-media ${item.art ?? ''}">${renderProductMedia(item)}</div>
      <div class="drawer-product-copy">
        <span class="drawer-product-category">${item.category}</span>
        <h3 class="drawer-product-name">${item.product}</h3>
        <p class="drawer-unit-price">${money.format(item.price)} c/u</p>
        <div class="drawer-quantity" aria-label="Cantidad de ${item.product}">
          <button type="button" data-cart-action="minus" data-cart-index="${index}" aria-label="Reducir cantidad" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
          <span>${item.quantity}</span>
          <button type="button" data-cart-action="plus" data-cart-index="${index}" aria-label="Aumentar cantidad">＋</button>
        </div>
      </div>
      <div class="drawer-line-end">
        <button class="drawer-remove" type="button" data-cart-action="remove" data-cart-index="${index}" aria-label="Quitar ${item.product}">×</button>
        <p class="drawer-line-total">${money.format(item.price * item.quantity)}</p>
      </div>
    </article>
  `).join('')
}

drawerItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cart-action]')
  if (!button) return
  const index = Number(button.dataset.cartIndex)
  const item = state.cart[index]
  if (!item) return

  if (button.dataset.cartAction === 'plus') item.quantity += 1
  if (button.dataset.cartAction === 'minus') item.quantity = Math.max(1, item.quantity - 1)
  if (button.dataset.cartAction === 'remove') state.cart.splice(index, 1)
  updateCart()
})

function setDrawer(open) {
  drawer.classList.toggle('open', open)
  backdrop.classList.toggle('show', open)
  drawer.setAttribute('aria-hidden', String(!open))
}

document.querySelectorAll('[data-open-cart]').forEach((button) => button.addEventListener('click', () => setDrawer(true)))
document.querySelectorAll('[data-close-cart]').forEach((button) => button.addEventListener('click', () => setDrawer(false)))
backdrop.addEventListener('click', () => setDrawer(false))
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setDrawer(false) })

document.querySelector('[data-clear-cart]').addEventListener('click', () => {
  state.cart = []
  state.coupon = null
  couponApplied.hidden = true
  summaryDiscount.hidden = true
  drawerCoupon.hidden = false
  drawerCoupon.querySelector('.coupon-toggle').hidden = false
  updateCart()
})

document.querySelector('[data-toggle-coupon]').addEventListener('click', (event) => {
  const open = !couponForm.classList.contains('open')
  couponForm.classList.toggle('open', open)
  event.currentTarget.setAttribute('aria-expanded', String(open))
  if (open) couponCode.focus()
})

document.querySelector('[data-apply-coupon]').addEventListener('click', () => {
  if (!couponCode.value.trim()) return
  state.coupon = 'ILARA10'
  couponForm.classList.remove('open')
  drawerCoupon.querySelector('.coupon-toggle').hidden = true
  couponApplied.hidden = false
  summaryDiscount.hidden = false
  updateCart()
  showToast('Cupón ILARA10 aplicado')
})

document.querySelector('[data-remove-coupon]').addEventListener('click', () => {
  state.coupon = null
  couponApplied.hidden = true
  summaryDiscount.hidden = true
  drawerCoupon.querySelector('.coupon-toggle').hidden = false
  updateCart()
})

function showToast(message) {
  toast.textContent = message
  toast.classList.add('show')
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200)
}

document.querySelectorAll('[data-toast]').forEach((button) => {
  button.addEventListener('click', () => showToast(button.dataset.toast))
})

document.querySelector('[data-checkout]').addEventListener('click', () => {
  showToast('Tu selección está lista para continuar por WhatsApp')
})

document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const dark = document.body.classList.toggle('dark')
  event.currentTarget.textContent = dark ? '☀' : '☾'
})

updateCart()
setDrawer(true)
