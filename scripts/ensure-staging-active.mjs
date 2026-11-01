/**
 * Restores a Free-tier paused staging project before CI cloud checks.
 * Uses SUPABASE_ACCESS_TOKEN + SUPABASE_TEST_PROJECT_REF. Never prints secrets.
 */
const ref = process.env.SUPABASE_TEST_PROJECT_REF?.trim() || ''
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim() || ''
if (!ref || !token) {
  console.error('SUPABASE_TEST_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
}

async function getStatus() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, { headers })
  if (!res.ok) throw new Error(`project lookup failed: HTTP ${res.status}`)
  const body = await res.json()
  return body.status || 'UNKNOWN'
}

async function restore() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/restore`, {
    method: 'POST',
    headers,
  })
  if (!res.ok && res.status !== 200) {
    const text = await res.text()
    throw new Error(`restore failed: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
}

const before = await getStatus()
console.log(`staging status before: ${before}`)
if (before === 'ACTIVE_HEALTHY') {
  console.log('PASS: staging already active')
  process.exit(0)
}
if (before === 'INACTIVE' || before === 'GOING_DOWN') {
  console.log('Restoring paused staging project…')
  await restore()
}

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10_000))
  const status = await getStatus()
  console.log(`wait ${i + 1}/60 status=${status}`)
  if (status === 'ACTIVE_HEALTHY') {
    console.log('PASS: staging active')
    process.exit(0)
  }
}

console.error('staging did not become ACTIVE_HEALTHY in time')
process.exit(1)
