import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import 'server-only'
import { parseLocalSeoFaultText, type ParsedLocalSeoFaults } from '@/lib/catalog/parseLocalSeoFault'

export type LocalSeoFaults = ParsedLocalSeoFaults

const EMPTY: LocalSeoFaults = { productIds: new Set(), sitemap: null }
const FAULT_FILENAME = '.seo-fault-local'

/**
 * Fallos de prueba locales. Inerte en Vercel y sin la env de permiso.
 * Archivo fijo en el cwd; un visitante no puede activarlo por URL.
 */
function faultFilePath(): string | null {
  if (process.env.VERCEL) return null
  if (process.env.ILARA_ALLOW_SEO_FAULT !== '1') return null
  return path.join(process.cwd(), FAULT_FILENAME)
}

export function readLocalSeoFaults(): LocalSeoFaults {
  const file = faultFilePath()
  if (!file) return EMPTY
  try {
    if (!existsSync(/* turbopackIgnore: true */ file)) return EMPTY
    return parseLocalSeoFaultText(readFileSync(/* turbopackIgnore: true */ file, 'utf8'))
  } catch {
    return EMPTY
  }
}

export function isLocalProductProviderFault(id: number): boolean {
  const faults = readLocalSeoFaults()
  if (faults.productIds === 'all') return true
  return faults.productIds.has(String(id))
}

export function localSitemapFault(): 'error' | 'empty' | null {
  return readLocalSeoFaults().sitemap
}
