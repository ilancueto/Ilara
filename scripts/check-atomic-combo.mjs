/** Isolated PostgreSQL test; never connects to Supabase or uses Docker. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
  `)
  const baseline = read('20250101000000_baseline_core_schema.sql')
  for (const table of ['categories', 'products', 'combos', 'combo_items']) {
    const ddl = baseline.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
    assert.ok(ddl, `DDL ${table}`)
    await db.exec(ddl)
  }
  await db.exec(read('20260810221411_stage1_app_roles.sql'))
  const rls = read('20260810221412_stage1_rls_by_role.sql')
  const section = rls.slice(rls.indexOf('ALTER TABLE IF EXISTS public.combos'), rls.indexOf('--', rls.indexOf('GRANT ALL ON TABLE public.combo_items TO service_role;')))
  assert.ok(section.includes('combo_items_insert_admin'))
  await db.exec(section)
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.combos, public.products TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
    INSERT INTO public.user_roles(user_id, role) VALUES ('00000000-0000-0000-0000-000000000001','admin');
    INSERT INTO public.products(id,name,sale_price,stock) VALUES (1,'Fixture',2000,10);
  `)
  await db.exec(read('20260905162516_atomic_combo_save.sql'))
  const payload = { name: 'Kit', description: null, sale_price: 3000, is_active: true, items: [{ product_id: 1, quantity: 2 }] }
  const save = (body = payload, id = null, version = null) => db.query('select public.save_inventory_combo($1::jsonb,$2::bigint,$3::timestamptz) result', [JSON.stringify(body), id, version])
  await db.exec('SET ROLE anon')
  await assert.rejects(save(), /permission denied/)
  await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)")
  await assert.rejects(save(), /not_authorized/)
  await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
  const created = await save()
  const id = created.rows[0].result.id
  const row = async () => (await db.query('SELECT name, sale_price::text, updated_at::text FROM public.combos WHERE id=$1',[id])).rows[0]
  const before = await row()
  await assert.rejects(save({ ...payload, name: 'Broken', sale_price: 99, items: [{ product_id: 99999, quantity: 1 }] }, id, before.updated_at), /foreign key/)
  assert.deepEqual(await row(), before, 'failed edit rolls back header')
  assert.equal((await db.query('SELECT quantity FROM public.combo_items WHERE combo_id=$1',[id])).rows[0].quantity, 2, 'failed edit preserves components')
  await assert.rejects(save({ ...payload, items: [...payload.items, ...payload.items] }), /invalid_combo_items/)
  await assert.rejects(save({ ...payload, items: [{ product_id: 1, quantity: 1.5 }] }), /invalid_combo_items/)
  await assert.rejects(save({ ...payload, items: [{ product_id: 99999, quantity: 1 }] }), /foreign key/)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.combos')).rows[0].n, 1, 'failed creation leaves no orphan header')
  await save({ ...payload, name: 'Updated' }, id, before.updated_at)
  await assert.rejects(save({ ...payload, name: 'Stale' }, id, before.updated_at), /combo_changed/)
  assert.equal((await row()).name, 'Updated')
  const privileges = await db.query("SELECT prosecdef, has_function_privilege('anon',oid,'execute') anon_execute FROM pg_proc WHERE proname='save_inventory_combo'")
  assert.deepEqual(privileges.rows[0], { prosecdef: false, anon_execute: false })
  console.log('PASS: PostgreSQL combo transaction, anon/non-admin denial, rollback, item validation, stale edit and invoker privileges')
} finally { await db.close() }
