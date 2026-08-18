'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { mapMarginReport, marginReportError } from './mappers'
import type { MarginChannel, MarginReport } from './types'

export async function loadMarginReport(
  from: string,
  to: string,
  channel: MarginChannel = 'combined'
): Promise<MarginReport> {
  const { data, error } = await getBrowserSupabase().rpc('commercial_margin_report', {
    p_from: from,
    p_to: to,
    p_channel: channel,
    p_product_id: null,
    p_category_id: null,
  })
  if (error) throw marginReportError(error.message || '')
  return mapMarginReport(data)
}
