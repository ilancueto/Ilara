/**
 * Pesos con locale fijo: el mismo resultado en Node (SSR) y en el navegador.
 * Evita hydration mismatch al usar toLocaleString() sin locale (depende del entorno).
 */
const pesoEntero = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const pesoExacto = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatPesoAR(value: number): string {
  return pesoEntero.format(value)
}

/** Totales que pueden incluir centavos, por ejemplo tarifas de logística. */
export function formatPesoARExact(value: number): string {
  return pesoExacto.format(value)
}
