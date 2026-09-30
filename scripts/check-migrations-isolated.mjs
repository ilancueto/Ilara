import assert from 'node:assert/strict'
import { createIsolatedDatabase } from './lib/isolated-database.mjs'

const { db, migrations } = await createIsolatedDatabase()
try {
  const tables = await db.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`)
  assert.ok(tables.rows.length > 40)
  assert.deepEqual(tables.rows.filter(row => !row.relrowsecurity), [], 'Every public application table must enable RLS')
  await db.exec(`SET ROLE anon`)
  for (const table of ['sales', 'sale_items', 'orders', 'order_items', 'order_payments', 'user_roles']) {
    await assert.rejects(db.query(`SELECT * FROM public.${table}`), /permission denied/)
  }
  await assert.rejects(db.query('SELECT purchase_price, notes FROM public.products'), /permission denied/)
  await assert.rejects(db.query(`SELECT public.save_inventory_combo('{}'::jsonb)`), /permission denied/)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`RESET ROLE; SET ROLE ${role}`)
    await assert.rejects(db.query(`SELECT public.attach_mp_preference('{}'::jsonb)`), /permission denied/)
    await assert.rejects(db.query(`SELECT public.mp_preference_context('invalid')`), /permission denied/)
    await assert.rejects(db.query(`SELECT * FROM public.order_notification_outbox`), /permission denied/)
    await assert.rejects(db.query(`SELECT * FROM public.claim_order_notifications()`), /permission denied/)
  }
  await db.exec('RESET ROLE; SET ROLE anon')
  await db.query('SELECT id, name, sale_price FROM public.products')
  await db.exec('RESET ROLE')
  const publicBuckets = await db.query(`SELECT id FROM storage.buckets WHERE id IN ('receipts','payment-receipts') AND public`)
  assert.deepEqual(publicBuckets.rows, [], 'Receipt buckets must remain private')
  const adminId = '00000000-0000-0000-0000-000000000001'
  const sellerId = '00000000-0000-0000-0000-000000000002'
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${adminId}'),('${sellerId}');
    INSERT INTO public.user_roles(user_id,role) VALUES ('${adminId}','admin'),('${sellerId}','vendedor');
    INSERT INTO public.products(id,name,sale_price,purchase_price,stock,discount_percentage) VALUES (1,'SQL fixture',1000,400,20,10);
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','${sellerId}',false);`)
  const posPayload = { sale: { payment_method: 'efectivo', status: 'completed', total: 1 },
    lines: [{ line_type: 'product', product_id: 1, quantity: 2, unit_price: 1, subtotal: 1, product_name: 'HACK', discount_percentage: 99 }] }
  const sale = (await db.query('SELECT public.create_sale_with_items($1::jsonb) result', [JSON.stringify(posPayload)])).rows[0].result
  assert.equal(Number(sale.sale.total), 2000, 'POS must recalculate list price')
  assert.equal(Number(sale.lines[0].unit_price), 1000)
  assert.notEqual(sale.lines[0].product_name, 'HACK')
  assert.equal((await db.query('SELECT stock FROM products WHERE id=1')).rows[0].stock, 18)
  const sellerUpdate = await db.query('UPDATE products SET stock=999 WHERE id=1 RETURNING id')
  assert.deepEqual(sellerUpdate.rows, [], 'Seller RLS must reject inventory updates')
  assert.equal((await db.query('SELECT stock FROM products WHERE id=1')).rows[0].stock, 18)
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${adminId}',false)`)
  await db.query('SELECT public.delete_sale_and_restore_stock($1)', [sale.sale.id])
  assert.equal((await db.query('SELECT stock FROM products WHERE id=1')).rows[0].stock, 20)
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SET ROLE anon;`)
  const orderPayload = { idempotency_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', fulfillment_mode: 'retiro',
    customer_name: 'SQL fixture', customer_phone: '2995550101', access_capability_hash: 'a'.repeat(64), follow_token_hash: 'b'.repeat(64),
    lines: [{ line_type: 'product', product_id: 1, quantity: 2 }] }
  const create = async payload => (await db.query('SELECT public.create_catalog_order($1::jsonb) result', [JSON.stringify(payload)])).rows[0].result
  await assert.rejects(create({ ...orderPayload, total: 1 }), /client_price_not_allowed/)
  const order = await create(orderPayload)
  assert.equal(Number(order.total), 1800, 'Catalog discount is separate from POS pricing')
  const replay = await create(orderPayload)
  assert.equal(replay.order_id, order.order_id)
  assert.equal(replay.idempotent_replay, true)
  await assert.rejects(create({ ...orderPayload, customer_name: 'Changed' }), /idempotency_conflict/)
  await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${sellerId}',false)`)
  await assert.rejects(db.query(`SELECT public.transition_catalog_order($1,'confirmed')`, [order.order_id]), /not_authorized/)
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${adminId}',false)`)
  await db.query(`SELECT public.transition_catalog_order($1,'confirmed')`, [order.order_id])
  assert.equal((await db.query('SELECT stock FROM products WHERE id=1')).rows[0].stock, 18)
  await db.query(`SELECT public.transition_catalog_order($1,'cancelled','Isolated test')`, [order.order_id])
  assert.equal((await db.query('SELECT stock FROM products WHERE id=1')).rows[0].stock, 20)
  await db.query(`SELECT public.transition_catalog_order($1,'cancelled','Isolated test')`, [order.order_id])
  assert.equal((await db.query('SELECT stock FROM products WHERE id=1')).rows[0].stock, 20, 'Repeated cancellation must not restore stock twice')
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::integer count FROM order_notification_outbox WHERE order_id=$1', [order.order_id])).rows[0].count, 3, 'Created, confirmed and cancelled events persist once each')
  await db.exec('SET ROLE service_role')
  const jobs = (await db.query('SELECT * FROM public.claim_order_notifications(3)')).rows
  assert.equal(jobs.length, 3)
  assert.equal((await db.query('SELECT * FROM public.claim_order_notifications(3)')).rows.length, 0, 'A second worker cannot take leased jobs')
  const job = jobs[0]
  assert.equal((await db.query("SELECT public.finish_order_notification($1,$2,'sent') done", [job.id, '00000000-0000-0000-0000-000000000099'])).rows[0].done, false, 'Stale workers cannot complete a job')
  assert.equal((await db.query("SELECT public.finish_order_notification($1,$2,'pending','network') done", [job.id,job.lease_token])).rows[0].done, true)
  assert.equal((await db.query('SELECT * FROM public.claim_order_notifications(3)')).rows.length, 0, 'Retry backoff survives a worker restart')
  await db.query("UPDATE order_notification_outbox SET available_at=now()-interval '1 minute' WHERE id=$1", [job.id])
  const retry = (await db.query('SELECT * FROM public.claim_order_notifications(1)')).rows[0]
  assert.equal(retry.attempts, 2)
  assert.notEqual(retry.lease_token, job.lease_token)
  assert.equal((await db.query("SELECT public.finish_order_notification($1,$2,'sent') done", [retry.id,retry.lease_token])).rows[0].done, true)
  assert.equal((await db.query('SELECT * FROM public.claim_order_notifications(3)')).rows.length, 0, 'Sent jobs are never reclaimed')
  console.log('PASS: transactional outbox, deduplication, exclusive leases, fencing and persistent backoff')
  console.log(`PASS: ${migrations} complete migrations; ${tables.rows.length} public tables with RLS; anon denials; public catalog grants; private receipts`)
  console.log('PASS: POS authoritative pricing and stock; catalog pricing; idempotency; admin-only transitions; stock reservation and exactly-once restoration')
} finally { await db.close() }
