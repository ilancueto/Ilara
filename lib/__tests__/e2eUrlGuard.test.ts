import { afterEach, describe, it, expect, vi } from 'vitest'
import { isAllowedE2ESupabaseUrl, assertAllowedE2ESupabaseUrl } from '../../e2e/helpers/urlGuard'

const ref = 'abcdefghijklmnopqrst'
describe('cloud staging URL guard', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('requires an explicit staging ref and exact HTTPS origin', () => {
    vi.stubEnv('SUPABASE_TEST_PROJECT_REF', '')
    expect(isAllowedE2ESupabaseUrl(`https://${ref}.supabase.co`)).toBe(false)
    vi.stubEnv('SUPABASE_TEST_PROJECT_REF', ref)
    expect(isAllowedE2ESupabaseUrl(`https://${ref}.supabase.co`)).toBe(true)
    for (const url of [`http://${ref}.supabase.co`, `https://${ref}.supabase.co.evil.com`, `https://${ref}.supabase.co/?key=secret`, `https://user:pass@${ref}.supabase.co`, `https://${ref}.supabase.co/rest/v1`, 'http://127.0.0.1:54321', 'not-a-url']) {
      expect(isAllowedE2ESupabaseUrl(url)).toBe(false)
    }
  })
  it('blocks production even if somebody configures it as staging', () => {
    vi.stubEnv('SUPABASE_TEST_PROJECT_REF', 'qbbnvdmadgomfmrsfxlo')
    expect(isAllowedE2ESupabaseUrl('https://qbbnvdmadgomfmrsfxlo.supabase.co')).toBe(false)
    expect(() => assertAllowedE2ESupabaseUrl('https://secret:password@qbbnvdmadgomfmrsfxlo.supabase.co')).toThrow(/production is forbidden/)
  })
})
