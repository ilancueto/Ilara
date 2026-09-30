/** IDs públicos: enteros decimales positivos. `86abc` no se interpreta como 86. */
export function parsePublicProductId(raw: string): number | null {
  if (!/^\d{1,9}$/.test(raw)) return null
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}
