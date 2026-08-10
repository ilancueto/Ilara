import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Pruebas estructurales de las migraciones Etapa 0 (sin golpear producción ni PII).
 * Validan que el SQL versionado cierra anon/PUBLIC y limita columnas de products.
 */
describe('migraciones Etapa 0 — superficie anon (SEC-02 / STO-01)', () => {
  const root = join(process.cwd(), 'supabase', 'migrations')

  it('cierra sales y sale_items a anon', () => {
    const sql = readFileSync(join(root, '20260810021812_stage0_close_anon_sales.sql'), 'utf8')
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.sales FROM anon/i)
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.sale_items FROM anon/i)
    expect(sql).not.toMatch(/GRANT\s+SELECT\s+ON\s+TABLE\s+public\.sales\s+TO\s+anon/i)
  })

  it('revoca SELECT de anon y PUBLIC antes de grants por columna en catálogo', () => {
    const sql = readFileSync(
      join(root, '20260810021814_stage0_public_catalog_column_grants.sql'),
      'utf8'
    )
    for (const table of ['products', 'categories', 'combos', 'combo_items']) {
      expect(sql).toMatch(
        new RegExp(`REVOKE SELECT ON TABLE public\\.${table} FROM anon,\\s*PUBLIC`, 'i')
      )
    }
    expect(sql).toMatch(/GRANT SELECT \(/i)
    expect(sql).toMatch(/sale_price/)
    expect(sql).not.toMatch(/GRANT SELECT \([^)]*purchase_price/i)
    expect(sql).not.toMatch(/GRANT SELECT \([^)]*\bnotes\b/i)
    expect(sql).not.toMatch(/GRANT SELECT \([^)]*min_stock/i)
    // No debe quedar GRANT SELECT de tabla completa a PUBLIC
    expect(sql).not.toMatch(/GRANT SELECT ON TABLE public\.products TO PUBLIC/i)
  })

  it('marca receipts como privado con límites explícitos y SELECT estricto', () => {
    const raw = readFileSync(
      join(root, '20260810021815_stage0_receipts_private_bucket.sql'),
      'utf8'
    )
    // Ignorar comentarios SQL al buscar anti-patrones de política.
    const sql = raw
      .split('\n')
      .filter((line) => !/^\s*--/.test(line))
      .join('\n')
    expect(sql).toMatch(/public\s*=\s*false/)
    expect(sql).toMatch(/file_size_limit\s*=\s*5242880/)
    expect(sql).toMatch(/image\/jpeg/)
    expect(sql).toMatch(/image\/png/)
    expect(sql).toMatch(/image\/webp/)
    expect(sql).toMatch(/application\/pdf/)
    expect(sql).not.toMatch(/COALESCE\s*\(\s*file_size_limit/i)
    expect(sql).not.toMatch(/COALESCE\s*\(\s*allowed_mime_types/i)
    expect(sql).not.toMatch(/position\s*\(\s*'\/'\s+in\s+name\s*\)\s*=\s*0/i)
    expect(sql).toMatch(/split_part\(name,\s*'\/',\s*1\)\s*=\s*\(SELECT auth\.uid\(\)::text\)/)
    expect(sql).toMatch(/CREATE POLICY "receipts_authenticated_select"/)
  })

  it('RPC de catálogo con search_path y sin EXECUTE a PUBLIC residual', () => {
    const sql = readFileSync(
      join(root, '20260810021816_stage0_harden_catalog_sales_rpc.sql'),
      'utf8'
    )
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/search_path\s*=\s*public/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.catalog_sales_by_product\(\) FROM PUBLIC/)
    expect(sql).toMatch(/product_id bigint, units_sold bigint/)
  })

  it('inventario de legacy receipts no reintroduce SELECT permisivo', () => {
    const sql = readFileSync(
      join(root, '20260810023435_stage0_receipts_legacy_path_inventory.sql'),
      'utf8'
    )
    expect(sql).toMatch(/stage0_inventory_legacy_receipt_urls/)
    expect(sql).toMatch(/SECURITY INVOKER/)
    expect(sql).not.toMatch(/position\s*\(\s*'\/'\s+in\s+name\s*\)\s*=\s*0[\s\S]*CREATE POLICY/i)
  })

  it('forward-fix revoca EXECUTE de inventario legacy a authenticated', () => {
    const sql = readFileSync(
      join(root, '20260810215741_stage0_revoke_authenticated_legacy_inventory.sql'),
      'utf8'
    )
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.stage0_inventory_legacy_receipt_urls\(\) FROM authenticated/i
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.stage0_inventory_legacy_receipt_urls\(\) TO service_role/i
    )
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]*TO authenticated/i)
    expect(sql).toMatch(/service_role|privilegiad/i)
  })
})
