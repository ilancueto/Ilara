/** Tope que usa el catálogo para "sin límite de precio". */
export const BUDGET_NO_LIMIT = 999999

export type BudgetPreset = {
  id: string
  label: string
  min: number
  max: number
}

/**
 * Atajos de presupuesto de la barra de filtros. Aplican el mismo filtro de precio
 * (mínimo y máximo) que el panel "Filtros". Los topes están pensados para los precios de Ilara.
 */
export const BUDGET_PRESETS: BudgetPreset[] = [
  { id: 'hasta-2000', label: 'Hasta $2.000', min: 0, max: 2000 },
  { id: 'hasta-5000', label: 'Hasta $5.000', min: 0, max: 5000 },
  { id: 'mas-5000', label: 'Más de $5.000', min: 5001, max: BUDGET_NO_LIMIT },
]

/** Atajo activo según el rango de precio actual, o null si el rango no coincide con ninguno. */
export function activeBudgetPreset(min: number, max: number): BudgetPreset | null {
  return BUDGET_PRESETS.find((preset) => preset.min === min && preset.max === max) ?? null
}
