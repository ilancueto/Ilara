import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { cloudDbClient } from './lib/cloud-db-client.mjs'

const client = cloudDbClient()
try {
  await client.connect()
  await client.query('BEGIN')
  const product = (await client.query(`INSERT INTO public.products(name,sale_price,purchase_price,stock,visible_in_catalog)
    VALUES ('Cloud outbox fixture',1000,400,20,true) RETURNING id`)).rows[0]
  const payload = { idempotency_key: randomUUID(), fulfillment_mode: 'retiro', customer_name: 'Cloud fixture',
    customer_phone: '2995550188', customer_email: 'outbox@example.test', access_capability_hash: 'a'.repeat(64),
    follow_token_hash: 'b'.repeat(64), lines: [{ line_type: 'product', product_id: product.id, quantity: 1 }] }
  await client.query('SET LOCAL ROLE anon')
  const order = (await client.query('SELECT public.create_catalog_order($1::jsonb) result', [JSON.stringify(payload)])).rows[0].result
  await client.query('RESET ROLE; SET LOCAL ROLE service_role')
  const jobs = (await client.query('SELECT * FROM public.claim_order_notifications(3,$1)', [order.order_id])).rows
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].kind, 'created')
  assert.equal((await client.query('SELECT * FROM public.claim_order_notifications(3,$1)', [order.order_id])).rows.length, 0)
  const job = jobs[0]
  assert.equal((await client.query("SELECT public.finish_order_notification($1,$2,'sent') done", [job.id, randomUUID()])).rows[0].done, false)
  assert.equal((await client.query("SELECT public.finish_order_notification($1,$2,'pending','network') done", [job.id, job.lease_token])).rows[0].done, true)
  assert.equal((await client.query('SELECT * FROM public.claim_order_notifications(3,$1)', [order.order_id])).rows.length, 0)
  await client.query("UPDATE public.order_notification_outbox SET available_at=now()-interval '1 minute' WHERE id=$1", [job.id])
  const retry = (await client.query('SELECT * FROM public.claim_order_notifications(1,$1)', [order.order_id])).rows[0]
  assert.equal(retry.attempts, 2)
  assert.notEqual(retry.lease_token, job.lease_token)
  assert.equal((await client.query("SELECT public.finish_order_notification($1,$2,'sent') done", [retry.id,retry.lease_token])).rows[0].done, true)
  assert.equal((await client.query('SELECT * FROM public.claim_order_notifications(3,$1)', [order.order_id])).rows.length, 0)
  await client.query('ROLLBACK')
  assert.equal((await client.query('SELECT count(*)::integer count FROM public.orders WHERE id=$1', [order.order_id])).rows[0].count, 0)
  console.log('PASS: cloud outbox enqueue, exclusive lease, fencing, persistent retry and sent-job deduplication; fixture rolled back')
} catch (error) {
  console.error(`FAIL: cloud outbox (${error.code || 'assertion_failed'})`)
  process.exitCode = 1
} finally { await client.query('ROLLBACK').catch(() => {}); await client.end() }
