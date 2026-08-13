import { getBrowserSupabase } from '@/lib/supabase/browser'

const BUCKET = 'receipts'
/** URLs firmadas de corta duración (Etapa 0 / STO-01). */
export const RECEIPT_SIGNED_URL_TTL_SEC = 300
const DEFAULT_TTL_SEC = RECEIPT_SIGNED_URL_TTL_SEC
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024 // 5 MiB
export const RECEIPT_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

const EXT_TO_MIME: Record<string, (typeof RECEIPT_ALLOWED_MIME)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/**
 * Convierte lo guardado en `receipt_url` (path plano o URL pública legacy) al path en el bucket.
 */
export function receiptPathFromStored(stored: string | null | undefined): string | null {
  if (stored == null) return null
  const s = String(stored).trim()
  if (!s) return null

  const publicMarker = '/object/public/receipts/'
  const i = s.indexOf(publicMarker)
  if (i !== -1) {
    const rest = s.slice(i + publicMarker.length)
    return rest.split('?')[0] || null
  }

  // Signed URLs: /object/sign/receipts/...
  const signMarker = '/object/sign/receipts/'
  const j = s.indexOf(signMarker)
  if (j !== -1) {
    const rest = s.slice(j + signMarker.length)
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

export function validateReceiptFile(file: File): { ok: true; contentType: string; ext: string } | { ok: false; message: string } {
  if (!file || file.size === 0) {
    return { ok: false, message: 'El archivo está vacío o no es válido.' }
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, message: 'El comprobante no puede superar 5 MB.' }
  }
  const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const mimeFromExt = rawExt ? EXT_TO_MIME[rawExt] : undefined
  const contentType = (file.type || mimeFromExt || '').toLowerCase()
  if (!contentType || !(RECEIPT_ALLOWED_MIME as readonly string[]).includes(contentType)) {
    return { ok: false, message: 'Solo se permiten imágenes JPG/PNG/WebP o PDF.' }
  }
  const ext =
    rawExt && EXT_TO_MIME[rawExt]
      ? rawExt === 'jpeg'
        ? 'jpg'
        : rawExt
      : contentType === 'application/pdf'
        ? 'pdf'
        : contentType === 'image/png'
          ? 'png'
          : contentType === 'image/webp'
            ? 'webp'
            : 'jpg'
  return { ok: true, contentType, ext }
}

export async function uploadReceiptFile(file: File, kind: 'sale' | 'expense'): Promise<string> {
  const validation = validateReceiptFile(file)
  if (!validation.ok) throw new Error(validation.message)

  const { data: authData, error: authErr } = await getBrowserSupabase().auth.getUser()
  if (authErr || !authData.user?.id) {
    throw new Error('Debés iniciar sesión para subir comprobantes.')
  }
  const uid = authData.user.id

  const prefix = kind === 'sale' ? 'sale' : 'exp'
  // Nombre no predecible bajo prefijo del propietario.
  const fileName = `${prefix}-${crypto.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}-${Date.now()}`}.${validation.ext}`
  const path = `${uid}/${fileName}`

  const { error } = await getBrowserSupabase().storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: validation.contentType,
      cacheControl: 'private, max-age=0',
      upsert: false,
    })

  if (error) throw error
  // Guardar path relativo; nunca URL pública permanente.
  return path
}

export async function getReceiptSignedUrl(
  stored: string | null | undefined,
  expiresSec: number = DEFAULT_TTL_SEC
): Promise<string | null> {
  const path = receiptPathFromStored(stored)
  if (!path) return null

  const ttl = Math.min(Math.max(expiresSec, 60), 900)
  const { data, error } = await getBrowserSupabase().storage.from(BUCKET).createSignedUrl(path, ttl)
  if (error || !data?.signedUrl) {
    console.warn('[receipts] createSignedUrl failed')
    return null
  }
  return data.signedUrl
}

export async function deleteReceiptObject(stored: string | null | undefined): Promise<void> {
  const path = receiptPathFromStored(stored)
  if (!path) return
  const { error } = await getBrowserSupabase().storage.from(BUCKET).remove([path])
  if (error) console.warn('[receipts] remove:', error.message)
}
