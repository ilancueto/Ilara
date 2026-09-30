export const PROD_PROJECT_REF = 'qbbnvdmadgomfmrsfxlo'

/** Only the explicitly configured cloud staging project may receive test mutations. */
export function isAllowedTestSupabaseUrl(raw, stagingRef = process.env.SUPABASE_TEST_PROJECT_REF || '') {
  if (!/^[a-z]{20}$/.test(stagingRef) || stagingRef === PROD_PROJECT_REF) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname === `${stagingRef}.supabase.co`
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/'
  } catch { return false }
}

export function assertTestSupabaseUrl(raw) {
  if (!isAllowedTestSupabaseUrl(raw)) throw new Error('Test mutations require the explicitly configured cloud staging project; production is forbidden')
}
