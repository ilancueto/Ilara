import type { SupabaseClient } from '@supabase/supabase-js'

// These suites create no settlements. Remove their own receivables before sales,
// whose FK deliberately prevents deleting an account's financial history.
export async function cleanupFinancialFixtures(service: SupabaseClient, saleIds: number[]) {
  if (!saleIds.length) return
  const result = await service.from('financial_accounts').delete().in('sale_id', saleIds)
  if (result.error) throw new Error(`Financial fixture cleanup failed (${result.error.code})`)
}
