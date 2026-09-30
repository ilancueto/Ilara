export type ParsedLocalSeoFaults = {
  productIds: Set<string> | 'all'
  sitemap: 'error' | 'empty' | null
}

const EMPTY: ParsedLocalSeoFaults = { productIds: new Set(), sitemap: null }

export function parseLocalSeoFaultText(raw: string): ParsedLocalSeoFaults {
  const trimmed = raw.trim()
  if (!trimmed) return EMPTY

  if (trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed) as {
      product?: 'all' | Array<string | number>
      sitemap?: 'error' | 'empty' | null
    }
    if (json.product === 'all') {
      return { productIds: 'all', sitemap: json.sitemap ?? null }
    }
    const ids = new Set((json.product ?? []).map((id) => String(id)))
    return { productIds: ids, sitemap: json.sitemap ?? null }
  }

  const productIds = new Set<string>()
  let productAll = false
  let sitemap: ParsedLocalSeoFaults['sitemap'] = null
  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const [kind, value] = t.split(/\s+/, 2)
    if (kind === 'product' && value === 'all') productAll = true
    else if (kind === 'product' && value) productIds.add(value)
    else if (kind === 'sitemap' && (value === 'error' || value === 'empty')) sitemap = value
  }
  return { productIds: productAll ? 'all' : productIds, sitemap }
}
