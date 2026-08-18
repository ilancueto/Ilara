const STORAGE_KEY = 'ilara.pedidoSeguimiento'

export type StoredOrderAccess = {
  orderNumber: string
  access: string
  followToken?: string
  transferStartKey?: string
  mpStartKey?: string
}

function writeStore(payload: StoredOrderAccess): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function saveOrderAccess(
  orderNumber: string,
  access: string,
  followToken?: string | null
): void {
  if (!orderNumber || !access) return
  const previous = loadOrderAccess()
  writeStore({
    orderNumber,
    access,
    followToken: followToken || (previous?.orderNumber === orderNumber ? previous.followToken : undefined),
    transferStartKey: previous?.orderNumber === orderNumber ? previous.transferStartKey : undefined,
    mpStartKey: previous?.orderNumber === orderNumber ? previous.mpStartKey : undefined,
  })
}

export function storedFollow(stored: StoredOrderAccess): string | undefined {
  return stored.followToken
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
export function paymentStartKey(method: 'bank_transfer' | 'mercado_pago', rotate = false): string {
  const stored = loadOrderAccess()
  if (!stored) return crypto.randomUUID()
  const current = method === 'mercado_pago' ? stored.mpStartKey : stored.transferStartKey
  if (!rotate && current) return current
  const next = crypto.randomUUID()
  writeStore({
    ...stored,
    transferStartKey: method === 'bank_transfer' ? next : stored.transferStartKey,
    mpStartKey: method === 'mercado_pago' ? next : stored.mpStartKey,
  })
  return next
}
