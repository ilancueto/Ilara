import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { cloudTestEnv } from './lib/cloud-test-env.mjs'

const mode = process.argv[2]
if (!['integration', 'e2e'].includes(mode)) throw new Error('Use run-cloud-tests.mjs integration|e2e')
const { url, anon, service } = cloudTestEnv()
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service, E2E_SUPABASE_URL: url, E2E_ANON_KEY: anon, E2E_SERVICE_ROLE_KEY: service,
  ORDER_ACCESS_SECRET: process.env.ORDER_ACCESS_SECRET || 'cloud-staging-order-access-32chars',
  CRON_SECRET: process.env.CRON_SECRET || 'cloud-staging-cron-secret-32chars' }
const client = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
let catalogProductId
try {
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listed.error) throw new Error('Cloud staging user list failed')
  const users = listed.data.users
  async function ensureUser(email, password) {
    const existing = users.find(user => user.email === email)
    if (existing) return existing.id
    const result = await client.auth.admin.createUser({ email, password, email_confirm: true })
    if (result.error) throw new Error('Cloud staging fixture user creation failed')
    users.push(result.data.user)
    return result.data.user.id
  }
  const stages = ['0', '1', '61', '62', '63', '64', '65', '66', '8', '9']
  let firstAdmin
  for (const stage of stages) {
    const pairStage = stage === '1' ? '0' : ['8', '9'].includes(stage) ? '61' : stage
    const ids = []
    for (const letter of ['A', 'B']) {
      const email = `stage${pairStage}-${letter.toLowerCase()}@example.com`
      const password = `Stage${pairStage}-Test-Pass-${letter}1!`
      ids.push(await ensureUser(email, password))
      env[`STAGE${stage}_USER_${letter}_EMAIL`] = email
      env[`STAGE${stage}_USER_${letter}_PASSWORD`] = password
    }
    if (stage === '0') firstAdmin = ids[0]
    env[`STAGE${stage}_INTEGRATION`] = '1'
    env[`STAGE${stage}_SUPABASE_URL`] = url
    env[`STAGE${stage}_ANON_KEY`] = anon
    env[`STAGE${stage}_SERVICE_ROLE_KEY`] = service
  }
  const role = await client.from('user_roles').upsert({ user_id: firstAdmin, role: 'admin', updated_by: firstAdmin })
  if (role.error) throw new Error('Cloud staging admin fixture failed')
  env.SECURE_PUBLIC_FLOWS_INTEGRATION = '1'
  env.E2E_USER_EMAIL = 'e2e-admin@example.com'
  env.E2E_USER_PASSWORD = 'E2E-Test-Pass-A1!'
  const e2eId = await ensureUser(env.E2E_USER_EMAIL, env.E2E_USER_PASSWORD)
  const admin61 = users.find(user => user.email === 'stage61-a@example.com')
  const roles = await client.from('user_roles').upsert([
    { user_id: admin61.id, role: 'admin', updated_by: firstAdmin },
    { user_id: e2eId, role: 'admin', updated_by: firstAdmin },
  ])
  if (roles.error) throw new Error('Cloud staging fixture roles failed')
  if (mode === 'e2e') {
    const product = await client.from('products').insert({ name: `E2E Catalog Order ${Date.now()}`, sale_price: 2500, purchase_price: 1000, stock: 20, min_stock: 1, visible_in_catalog: true, discount_percentage: 0 }).select('id,name').single()
    if (product.error) throw new Error('Cloud staging catalog fixture failed')
    catalogProductId = product.data.id
    env.E2E_CATALOG_PRODUCT_ID = String(catalogProductId)
    env.E2E_CATALOG_PRODUCT_NAME = product.data.name
    env.CI = 'true'
    const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { env, stdio: 'inherit', shell: process.platform === 'win32' })
    if (build.status !== 0) throw new Error('Cloud E2E production build failed')
  }
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', mode === 'integration' ? 'test:integration' : 'test:e2e'], {
    env, stdio: 'inherit', shell: process.platform === 'win32',
  })
  process.exitCode = result.status ?? 1
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally {
  if (catalogProductId) {
    const cleanup = await client.from('products').delete().eq('id', catalogProductId)
    if (cleanup.error) { console.error('Cloud staging catalog fixture cleanup failed'); process.exitCode = 1 }
  }
}
