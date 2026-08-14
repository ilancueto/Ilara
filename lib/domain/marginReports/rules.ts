import type { MarginPeriod } from './types'

const isoDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function marginPeriodRange(period: MarginPeriod, now = new Date()) {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const from = new Date(to)
  if (period === 'month') from.setDate(1)
  else from.setDate(from.getDate() - (period === '30d' ? 29 : period === '90d' ? 89 : 364))
  return { from: isoDate(from), to: isoDate(to) }
}

export function formatMarginMoney(value: number | null): string {
  if (value == null) return 'Sin datos'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}
