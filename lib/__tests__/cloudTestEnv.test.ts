import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloudTestEnv } from '../../scripts/lib/cloud-test-env.mjs'

const ref = 'abcdefghijklmnopqrst'
describe('cloud staging connection guards', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_TEST_PROJECT_REF', ref)
    vi.stubEnv('SUPABASE_TEST_URL', `https://${ref}.supabase.co`)
    vi.stubEnv('SUPABASE_TEST_ANON_KEY', 'test-anon')
    vi.stubEnv('SUPABASE_TEST_SERVICE_ROLE_KEY', 'test-service')
  })
  afterEach(() => vi.unstubAllEnvs())
  it('permits a direct DB or session pooler belonging to the same staging project', () => {
    for (const db of [`postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres?sslmode=require`, `postgresql://postgres.${ref}:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require`]) {
      vi.stubEnv('SUPABASE_TEST_DB_URL', db)
      expect(cloudTestEnv({ database: true }).ref).toBe(ref)
    }
  })
  it('rejects a different DB, production or a lookalike pooler without echoing passwords', () => {
    for (const db of ['postgresql://postgres:secret@db.qbbnvdmadgomfmrsfxlo.supabase.co/postgres', `postgresql://postgres:secret@evil.pooler.supabase.com.evil.test/postgres`, `postgresql://postgres.other:secret@aws-0-sa-east-1.pooler.supabase.com/postgres`]) {
      vi.stubEnv('SUPABASE_TEST_DB_URL', db)
      expect(() => cloudTestEnv({ database: true })).toThrow(/configured staging project/)
      try { cloudTestEnv({ database: true }) } catch (error) { expect(String(error)).not.toContain('secret') }
    }
  })
  it('has no fallback to development or production keys', () => {
    vi.stubEnv('SUPABASE_TEST_SERVICE_ROLE_KEY', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'production-secret')
    expect(() => cloudTestEnv()).toThrow(/staging API keys/)
  })
})
