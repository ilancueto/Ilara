/**
 * Utilidades para exportar CSV con formato compatible con Excel/LibreOffice (UTF-8, BOM).
 * Usamos punto y coma (;) como delimitador para que Excel en español/Argentina separe bien las columnas.
 */

/** BOM UTF-8: hace que Excel y LibreOffice abran el archivo con encoding correcto (tildes, ñ). */
export const CSV_BOM = '\uFEFF'

/** Delimitador para CSV: en español Excel usa ; en vez de , así se abren bien las columnas. */
export const CSV_DELIMITER = ';'

/**
 * Crea un Blob listo para descargar como CSV con BOM UTF-8.
 */
export function createCsvBlob(content: string): Blob {
  return new Blob([CSV_BOM + content], { type: 'text/csv;charset=utf-8;' })
}

/**
 * Escapa un valor para CSV: si tiene delimitador (;), comillas o saltos de línea, lo envuelve en comillas
 * y duplica las comillas internas.
 */
export function escapeCsvValue(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Formatea fecha para CSV en formato dd/MM/yyyy (Argentina). */
export function formatDateCsv(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Formatea número para CSV con separador de miles (Argentina). */
export function formatNumberCsv(num: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}
