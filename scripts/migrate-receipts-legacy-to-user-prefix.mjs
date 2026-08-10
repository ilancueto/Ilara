/**
 * Migra comprobantes del bucket `receipts` desde paths legacy (solo nombre de archivo en la raíz)
 * hacia `{ownerId}/nombre`, alineado con las políticas en 20260328203100_storage_receipts_owner_prefix.sql.
 *
 * Requisitos:
 *   - Variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role; nunca en el cliente).
 *   - Ventas: usa sales.created_by como carpeta (filas sin created_by se listan y se omiten).
 *   - Gastos: usa expenses.user_id.
 *
 * Uso (simulación, no escribe):
 *   node --env-file=.env.local scripts/migrate-receipts-legacy-to-user-prefix.mjs
 *
 * Uso real:
 *   node --env-file=.env.local scripts/migrate-receipts-legacy-to-user-prefix.mjs --execute
 *
 * Después de migrar todo (0 legacy en inventario) y verificar la app, aplicar:
 *   supabase/migrations/*_stage0_receipts_private_bucket.sql
 * (SELECT estricto sin position('/' in name)=0). Ver docs/STO01_LEGACY_RECEIPTS.md
 */

import { createClient } from '@supabase/supabase-js'

const BUCKET = 'receipts'

function receiptPathFromStored(stored) {
  if (stored == null) return null
  const s = String(stored).trim()
  if (!s) return null
  const publicMarker = '/object/public/receipts/'
  const i = s.indexOf(publicMarker)
  if (i !== -1) {
    const rest = s.slice(i + publicMarker.length)
    return rest.split('?')[0] || null
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const parts = u.pathname.split('/').filter(Boolean)
      const bi = parts.indexOf('receipts')
      if (bi !== -1 && bi < parts.length - 1) {
        return parts.slice(bi + 1).join('/')
      }
    } catch {
      /* ignore */
    }
    const seg = s.split('/').pop()
    return seg ? seg.split('?')[0] : null
  }
  return s.split('?')[0] || null
}

/** Path relativo al bucket: legacy = un solo segmento (sin "/"). */
function isLegacyBucketPath(path) {
  if (!path || typeof path !== 'string') return false
  const p = path.split('?')[0].replace(/^\/+/, '')
  return p.length > 0 && !p.includes('/')
}

function contentTypeForPath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

async function migrateTable({
  supabase,
  table,
  idColumn,
  ownerColumn,
  execute,
}) {
  const { data: rows, error } = await supabase
    .from(table)
    .select(`${idColumn}, receipt_url, ${ownerColumn}`)
    .not('receipt_url', 'is', null)

  if (error) {
    console.error(`[${table}] select`, error.message)
    return { ok: false, migrated: 0, skipped: 0, errors: 1 }
  }

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows || []) {
    const raw = row.receipt_url
    const path = receiptPathFromStored(raw)
    if (!path || !isLegacyBucketPath(path)) {
      skipped += 1
      continue
    }
    const ownerId = row[ownerColumn]
    if (!ownerId) {
      console.warn(`[${table}] id=${row[idColumn]} sin ${ownerColumn}; omitido (${path})`)
      skipped += 1
      continue
    }
    const newPath = `${ownerId}/${path}`

    if (!execute) {
      console.log(`[dry-run] ${table}#${row[idColumn]}: ${path} -> ${newPath}`)
      migrated += 1
      continue
    }

    const { data: bin, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
    if (dlErr || !bin) {
      console.error(`[${table}#${row[idColumn]}] download ${path}:`, dlErr?.message || 'sin datos')
      errors += 1
      continue
    }

    const buf = bin instanceof Blob ? await bin.arrayBuffer() : bin
    const body = Buffer.from(buf)

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, body, {
      contentType: contentTypeForPath(path),
      upsert: false,
      cacheControl: '3600',
    })
    if (upErr) {
      console.error(`[${table}#${row[idColumn]}] upload ${newPath}:`, upErr.message)
      errors += 1
      continue
    }

    const { error: updErr } = await supabase
      .from(table)
      .update({ receipt_url: newPath })
      .eq(idColumn, row[idColumn])

    if (updErr) {
      console.error(`[${table}#${row[idColumn]}] update DB:`, updErr.message)
      await supabase.storage.from(BUCKET).remove([newPath])
      errors += 1
      continue
    }

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
    if (rmErr) {
      console.warn(`[${table}#${row[idColumn]}] remove legacy ${path}:`, rmErr.message)
    }
    console.log(`[ok] ${table}#${row[idColumn]}: ${path} -> ${newPath}`)
    migrated += 1
  }

  return { ok: errors === 0, migrated, skipped, errors }
}

async function main() {
  const execute = process.argv.includes('--execute')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    console.error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (service role de Supabase → Settings → API).'
    )
    process.exit(1)
  }

  if (!execute) {
    console.log('Modo simulación (sin cambios). Añadí --execute para migrar de verdad.\n')
  } else {
    console.log('Modo EJECUCIÓN: se copiarán archivos, actualizará DB y borrará el objeto legacy.\n')
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const sales = await migrateTable({
    supabase,
    table: 'sales',
    idColumn: 'id',
    ownerColumn: 'created_by',
    execute,
  })
  const expenses = await migrateTable({
    supabase,
    table: 'expenses',
    idColumn: 'id',
    ownerColumn: 'user_id',
    execute,
  })

  console.log('\n--- Resumen ---')
  console.log('sales:', sales)
  console.log('expenses:', expenses)
  if (!execute) {
    console.log('\nCuando revises la lista, ejecutá de nuevo con --execute.')
  } else {
    console.log(
      '\nSi inventario legacy = 0, aplicá stage0_receipts_private_bucket (SELECT estricto). Ver docs/STO01_LEGACY_RECEIPTS.md'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
