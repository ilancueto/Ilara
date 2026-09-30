import { spawnSync } from 'node:child_process'
import { PROD_PROJECT_REF } from '../../lib/security/testSupabaseTarget.mjs'

export function generateCloudTypes(root) {
  const ref = process.env.SUPABASE_TEST_PROJECT_REF?.trim() || ''
  if (!/^[a-z]{20}$/.test(ref) || ref === PROD_PROJECT_REF) throw new Error('Explicit cloud staging project required for type generation')
  // Only validated identifiers enter the command; credentials remain in the environment.
  const result = spawnSync(`supabase gen types typescript --project-id ${ref} --schema public`, {
    cwd: root, encoding: 'utf8', shell: true,
  })
  if (result.status !== 0 || !result.stdout.includes('export type Database')) throw new Error('Cloud type generation failed; check Supabase authentication and staging access')
  return result.stdout
}
