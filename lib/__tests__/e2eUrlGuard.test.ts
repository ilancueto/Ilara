import { describe, it, expect } from 'vitest'
import { isAllowedE2ESupabaseUrl, assertAllowedE2ESupabaseUrl } from '../../e2e/helpers/urlGuard'

describe('E2E Supabase URL guard (mutante)', () => {
  it('allows explicit loopback hosts', () => {
    expect(isAllowedE2ESupabaseUrl('http://127.0.0.1:54321')).toBe(true)
    expect(isAllowedE2ESupabaseUrl('http://localhost:54321')).toBe(true)
    expect(isAllowedE2ESupabaseUrl('http://127.0.0.1:54321/')).toBe(true)
    expect(isAllowedE2ESupabaseUrl('http://127.0.0.1:54321/rest/v1')).toBe(true)
    expect(isAllowedE2ESupabaseUrl('HTTP://LOCALHOST:54321')).toBe(true)
    expect(isAllowedE2ESupabaseUrl('http://[::1]:54321')).toBe(true)
  })

  it('rejects production project ref in any form', () => {
    expect(
      isAllowedE2ESupabaseUrl('https://qbbnvdmadgomfmrsfxlo.supabase.co')
    ).toBe(false)
    expect(
      isAllowedE2ESupabaseUrl('https://QbbnVDmadgomfmrsfxlo.supabase.co/auth/v1')
    ).toBe(false)
    expect(
      isAllowedE2ESupabaseUrl('http://127.0.0.1:54321/?ref=qbbnvdmadgomfmrsfxlo')
    ).toBe(false)
  })

  it('rejects remote HTTPS Supabase and lookalikes', () => {
    expect(isAllowedE2ESupabaseUrl('https://xyzabc.supabase.co')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('https://xyzabc.supabase.co:443')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('https://xyzabc.supabase.co/rest/v1')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('https://db.example.com')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('https://127.0.0.1.evil.com')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('http://192.168.1.10:54321')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('http://10.0.0.5:54321')).toBe(false)
  })

  it('rejects credentials in URL and bad schemes', () => {
    expect(isAllowedE2ESupabaseUrl('http://user:pass@127.0.0.1:54321')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('ftp://127.0.0.1:54321')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('not-a-url')).toBe(false)
    expect(isAllowedE2ESupabaseUrl('')).toBe(false)
  })

  it('assert throws without echoing secrets', () => {
    expect(() =>
      assertAllowedE2ESupabaseUrl('https://qbbnvdmadgomfmrsfxlo.supabase.co')
    ).toThrow(/loopback local permitido/)
  })
})
