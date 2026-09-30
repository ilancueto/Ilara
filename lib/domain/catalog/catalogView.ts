const ALLOWED_SORT = new Set([
  'nuevo-desc',
  'nuevo-asc',
  'nombre-asc',
  'nombre-desc',
  'vendidos-desc',
  'precio-asc',
  'precio-desc',
])

export const CATALOG_SORT_DEFAULT = 'nuevo-desc'
export const CATALOG_PRICE_MAX_UNSET = 999999
export const COMBOS_FILTER = 'combos'
/** Tope de página para no crear URLs de paginación ilimitadas. */
export const CATALOG_PAGE_MAX = 100
export const CATALOG_PAGE_SIZE = 15
const KNOWN_QUERY_KEYS = ['q', 'cat', 'sort', 'page', 'min', 'max'] as const

export type CatalogViewState = {
  q: string
  cat: string
  sort: string
  page: number
  min: number
  max: number
}

export const CATALOG_VIEW_DEFAULT: CatalogViewState = {
  q: '',
  cat: 'all',
  sort: CATALOG_SORT_DEFAULT,
  page: 1,
  min: 0,
  max: CATALOG_PRICE_MAX_UNSET,
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function asPositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function asNonNegativeInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function parseCatalogView(
  sp: Record<string, string | string[] | undefined> | URLSearchParams
): CatalogViewState {
  const get = (key: string) =>
    sp instanceof URLSearchParams ? (sp.get(key) ?? '') : firstString(sp[key])

  const sortRaw = get('sort')
  const min = asNonNegativeInt(get('min'), 0)
  let max = asNonNegativeInt(get('max'), CATALOG_PRICE_MAX_UNSET)
  if (max < min) max = CATALOG_PRICE_MAX_UNSET

  const catRaw = get('cat').trim()
  const cat = catRaw === '' ? 'all' : catRaw.slice(0, 40)

  return {
    q: get('q').slice(0, 120),
    cat,
    sort: ALLOWED_SORT.has(sortRaw) ? sortRaw : CATALOG_SORT_DEFAULT,
    page: parsePage(get('page')),
    min,
    max,
  }
}

function parsePage(raw: string): number {
  if (raw.length > 3) return CATALOG_PAGE_MAX + 1
  return asPositiveInt(raw, 1)
}

export function serializeCatalogView(state: CatalogViewState): string {
  const p = new URLSearchParams()
  const q = state.q.trim()
  if (q) p.set('q', q)
  if (state.cat && state.cat !== 'all') p.set('cat', state.cat)
  if (state.sort && state.sort !== CATALOG_SORT_DEFAULT) p.set('sort', state.sort)
  if (state.page > 1) p.set('page', String(state.page))
  if (state.min > 0) p.set('min', String(state.min))
  if (state.max < CATALOG_PRICE_MAX_UNSET) p.set('max', String(state.max))
  return p.toString()
}

export function catalogViewPath(state: CatalogViewState): string {
  const qs = serializeCatalogView(state)
  return qs ? `/catalogo?${qs}` : '/catalogo'
}

/**
 * Indexable: listado por defecto y paginación `?page=N` (N>1) sin búsqueda, filtro ni orden alternativo.
 * Búsqueda interna, categoría, precio y sort distinto del default: noindex, follow, canonical propio.
 * No se canonicaliza contenido distinto hacia la página 1.
 */
export function isCatalogViewIndexable(state: CatalogViewState): boolean {
  return (
    state.q.trim() === '' &&
    state.cat === 'all' &&
    state.sort === CATALOG_SORT_DEFAULT &&
    state.min === 0 &&
    state.max === CATALOG_PRICE_MAX_UNSET
  )
}

function incomingKnownCatalogQuery(
  sp: Record<string, string | string[] | undefined> | URLSearchParams
): string {
  const get = (key: string) =>
    sp instanceof URLSearchParams ? (sp.get(key) ?? '') : firstString(sp[key])
  const p = new URLSearchParams()
  for (const key of KNOWN_QUERY_KEYS) {
    const raw = get(key)
    if (raw !== '') p.set(key, raw)
  }
  return p.toString()
}

/** Ruta canónica si los parámetros conocidos no están normalizados; si no, null. */
export function catalogNormalizeRedirectPath(
  sp: Record<string, string | string[] | undefined> | URLSearchParams
): string | null {
  const view = parseCatalogView(sp)
  const canonical = serializeCatalogView(view)
  const incoming = incomingKnownCatalogQuery(sp)
  if (incoming === canonical) return null
  return catalogViewPath(view)
}
