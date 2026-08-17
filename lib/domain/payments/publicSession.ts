const STORAGE_KEY = 'ilara.pedidoSeguimiento'

export type StoredOrderAccess = {
  orderNumber: string
  access: string
  transferStartKey?: string
}

function writeStore(payload: StoredOrderAccess): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function saveOrderAccess(orderNumber: string, access: string): void {
  if (!orderNumber || !access) return
  const previous = loadOrderAccess()
  writeStore({
    orderNumber,
    access,
    transferStartKey: previous?.orderNumber === orderNumber ? previous.transferStartKey : undefined,
  })
}

export function loadOrderAccess(): StoredOrderAccess | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredOrderAccess
    if (!parsed.orderNumber || !parsed.access) return null
    return parsed
  } catch {
    return null
  }
}

/** Misma clave si se pierde la red; otra solo cuando hay que reintentar de verdad. */
export function paymentStartKey(rotate = false): string {
  const stored = loadOrderAccess()
  if (!stored) return crypto.randomUUID()
  if (!rotate && stored.transferStartKey) return stored.transferStartKey
  const next = crypto.randomUUID()
  writeStore({ ...stored, transferStartKey: next })
  return next
}
