'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { mapMarginReport, marginReportError } from './mappers'
import type { MarginReport } from './types'

export async function loadMarginReport(from: string, to: string): Promise<MarginReport> {
  const { data, error } = await getBrowserSupabase().rpc('sales_margin_report', {
    p_from: from,
    p_to: to,
  })
  if (error) throw marginReportError(error.message || '')
  return mapMarginReport(data)
}
