import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'supabase', 'migrations')
const STAGE0_CATALOG = '20260810021814_stage0_public_catalog_column_grants.sql'
const M11 = '20260810221411_stage1_app_roles.sql'
const M12 = '20260810221412_stage1_rls_by_role.sql'
const M13 = '20260810221413_stage1_pos_authoritative_pricing.sql'
const M14 = '20260812002815_stage1_harden_legacy_anon_grants.sql'

function read(name: string): string {
  return readFileSync(join(root, name), 'utf8')
}

/** Simula policies de user_roles tras aplicar migraciones en orden (análisis textual). */
function simulateUserRolesPoliciesAfterSequence(m11: string, m12: string): Set<string> {
  const policies = new Set<string>()

  const applyCreates = (sql: string) => {
    const re = /CREATE POLICY\s+"([^"]+)"\s+ON\s+public\.user_roles/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(sql)) !== null) policies.add(m[1])
  }
  const applyDrops = (sql: string) => {
    const re = /DROP POLICY IF EXISTS\s+"([^"]+)"\s+ON\s+public\.user_roles/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(sql)) !== null) policies.delete(m[1])
  }

  // 21411
  applyDrops(m11)
  applyCreates(m11)

  // 21412 preflight: no debe borrar user_roles via %_admin% en v_tables
  // Simular drops explícitos de user_roles y recreaciones al final
  applyDrops(m12)
  applyCreates(m12)

  return policies
}

describe('Etapa 1 — secuencia 21411→21412→21413 (interacciones)', () => {
  const stage0Catalog = read(STAGE0_CATALOG)
  const m11 = read(M11)
  const m12 = read(M12)
  const m13 = read(M13)
  const m14 = read(M14)

  it('tras la secuencia, user_roles conserva select_own y select_admin', () => {
    const final = simulateUserRolesPoliciesAfterSequence(m11, m12)
    expect(final.has('user_roles_select_own')).toBe(true)
    expect(final.has('user_roles_select_admin')).toBe(true)
  })

  it('21412 no incluye user_roles en el array de barrido stage1 %_admin%', () => {
    // El bug original: user_roles en v_tables + LIKE '%_admin%'
    const tablesBlock = m12.match(/v_tables text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] ?? ''
    expect(tablesBlock).not.toMatch(/'user_roles'/)
    expect(m12).toMatch(/REAFIRMAR user_roles|user_roles_select_admin/)
    // Debe recrear ambas al final
    const lastOwn = m12.lastIndexOf('CREATE POLICY "user_roles_select_own"')
    const lastAdmin = m12.lastIndexOf('CREATE POLICY "user_roles_select_admin"')
    expect(lastOwn).toBeGreaterThan(-1)
    expect(lastAdmin).toBeGreaterThan(-1)
  })

  it('21412 preserva las policies anónimas mínimas creadas por Etapa 0', () => {
    const publicPolicies = [
      'Anon catalog read products',
      'Anon catalog read categories',
      'Anon read active combos',
      'Anon read combo_items for active combos',
    ]

    for (const policy of publicPolicies) {
      expect(stage0Catalog).toContain(`CREATE POLICY "${policy}"`)
      expect(m12).toContain(`policyname = '${policy}'`)
    }

    // Esta policy usa USING(true): era eliminada por el preflight genérico.
    expect(stage0Catalog).toMatch(
      /CREATE POLICY "Anon catalog read categories"[\s\S]*?USING \(true\)/
    )
  })

  it('no hay DELETE directo authenticated en sales/sale_items al final de 21412', () => {
    expect(m12).not.toMatch(/CREATE POLICY "sales_delete_admin"/)
    expect(m12).not.toMatch(/CREATE POLICY "sale_items_delete_admin"/)
    expect(m12).toMatch(/DROP POLICY IF EXISTS "sales_delete_admin"/)
    expect(m12).toMatch(/DROP POLICY IF EXISTS "sale_items_delete_admin"/)
    // Grants: sin DELETE a authenticated
    expect(m12).toMatch(
      /GRANT SELECT,\s*UPDATE ON TABLE public\.sales TO authenticated/
    )
    expect(m12).not.toMatch(
      /GRANT SELECT,\s*UPDATE,\s*DELETE ON TABLE public\.sales TO authenticated/
    )
    expect(m12).toMatch(/GRANT SELECT ON TABLE public\.sale_items TO authenticated/)
    expect(m12).not.toMatch(
      /GRANT SELECT,\s*DELETE ON TABLE public\.sale_items TO authenticated/
    )
  })

  it('set_user_role y bootstrap comparten advisory lock 87201411', () => {
    expect(m11).toMatch(/pg_advisory_xact_lock\(87201411\)/)
    const lockCount = (m11.match(/pg_advisory_xact_lock\(87201411\)/g) || []).length
    expect(lockCount).toBeGreaterThanOrEqual(2)
  })

  it('funciones DEFINER usan search_path vacío', () => {
    for (const sql of [m11, m13]) {
      expect(sql).toMatch(/SET search_path = ''/)
      // No dejar search_path = public en funciones nuevas de stage1 roles/pos
    }
    expect(m11).not.toMatch(/SET search_path = public/)
    expect(m13).not.toMatch(/SET search_path = public/)
  })

  it('REVOKE EXECUTE de PUBLIC y anon en RPCs sensibles', () => {
    expect(m11).toMatch(/REVOKE ALL ON FUNCTION public\.set_user_role/)
    expect(m11).toMatch(/REVOKE ALL ON FUNCTION public\.bootstrap_first_admin\(uuid\) FROM authenticated/)
    expect(m13).toMatch(/REVOKE ALL ON FUNCTION public\.create_sale_with_items\(jsonb\) FROM PUBLIC/)
    expect(m13).toMatch(/REVOKE ALL ON FUNCTION public\.create_sale_with_items\(jsonb\) FROM anon/)
    expect(m13).toMatch(/REVOKE ALL ON FUNCTION public\.delete_sale_and_restore_stock\(integer\) FROM PUBLIC/)
  })

  it('payment_breakdown distingue clave presente inválida', () => {
    expect(m13).toMatch(/sale_rec \? 'payment_breakdown'/)
    expect(m13).toMatch(/invalid_payment_breakdown/)
    expect(m13).toMatch(/payment_breakdown_required/)
    expect(m13).toMatch(/payment_breakdown_not_allowed/)
    expect(m13).toMatch(/payment_status_mismatch/)
    expect(m13).toMatch(/jsonb_typeof\(v_elem\) <> 'object'/)
    expect(m13).toMatch(/IF v_bd_type <> 'array' THEN/)
    expect(m13).not.toMatch(/IF v_bd_type = 'null' THEN[\s\S]*?v_breakdown := NULL/)
  })

  it('delete solo por RPC; create_sale exige can_use_pos', () => {
    expect(m13).toMatch(/can_use_pos\(\)/)
    expect(m13).toMatch(/is_app_admin\(\)/)
    expect(m13).toMatch(/SECURITY DEFINER/)
    expect(m13).toMatch(
      /SELECT s\.receipt_url[\s\S]*?FROM public\.sales s[\s\S]*?FOR UPDATE;[\s\S]*?IF NOT FOUND THEN/
    )
    expect(m13).not.toMatch(
      /IF NOT EXISTS \(SELECT 1 FROM public\.sales WHERE id = p_sale_id\)/
    )
  })

  it('forward-fix elimina grants legacy que RLS no cubre', () => {
    expect(m14).toMatch(
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER[\s\S]*?public\.products/
    )
    expect(m14).toMatch(/REVOKE ALL ON SEQUENCE[\s\S]*?FROM anon, PUBLIC/)
    expect(m14).toMatch(
      /REVOKE ALL ON TABLE public\.products[\s\S]*?FROM authenticated/
    )
    expect(m14).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*?TO authenticated/)
  })

  it('forward-fix contiene helpers passkey e inventario legacy', () => {
    expect(m14).toMatch(/stage0_inventory_legacy_receipt_urls/)
    expect(m14).toMatch(/check_passkey_rate_limit/)
    expect(m14).toMatch(/cleanup_expired_passkey_challenges/)
    expect(m14).toMatch(/log_passkey_audit_event/)
    expect(m14).toMatch(/ALTER FUNCTION public\.catalog_sales_by_product\(\) SET search_path = ''/)
    expect(m14).toMatch(/CREATE OR REPLACE FUNCTION public\.update_stock_on_sale\(\)/)
    expect(m14).toMatch(/ALTER FUNCTION public\.update_updated_at_column\(\) SET search_path = ''/)
    expect(m14).toMatch(/Users can update receipts/)
    expect(m14).toMatch(/FROM PUBLIC, anon, authenticated/)
  })
})

describe('Etapa 1 — roles (21411)', () => {
  const sql = read(M11)

  it('define enum, tabla, helpers y last_admin', () => {
    expect(sql).toMatch(/app_role/)
    expect(sql).toMatch(/user_roles/)
    expect(sql).toMatch(/last_admin/)
    expect(sql).toMatch(/bootstrap_first_admin\(p_user_id uuid\)/)
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.bootstrap_first_admin\(\)/)
  })

  it('no usa user_metadata como fuente de rol', () => {
    const code = sql
      .split('\n')
      .filter((l) => !/^\s*--/.test(l))
      .join('\n')
    expect(code).not.toMatch(/user_metadata/)
  })
})

describe('Etapa 1 — POS (21413) precios autoritativos', () => {
  const sql = read(M13)
  const code = sql
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')

  it('ignora precios cliente y usa round lista', () => {
    expect(sql).toMatch(/round\(p\.sale_price::numeric, 0\)/)
    expect(code).not.toMatch(/elem->>'unit_price'/)
    expect(code).not.toMatch(/sale_rec->>'total'/)
    expect(sql).not.toMatch(/discount_percentage, 0\) \/ 100/)
  })
})
