import { supabase } from '@/lib/supabase'

const BUCKET = 'receipts'
const DEFAULT_TTL_SEC = 3600

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

export async function uploadReceiptFile(file: File, kind: 'sale' | 'expense'): Promise<string> {
  if (!file || file.size === 0) throw new Error('El archivo está vacío o no es válido.')

  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !authData.user?.id) {
    throw new Error('Debés iniciar sesión para subir comprobantes.')
  }
  const uid = authData.user.id

  const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ext = rawExt || 'jpg'
  const prefix = kind === 'sale' ? 'sale' : 'exp'
  const fileName = `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`
  const path = `${uid}/${fileName}`
  const contentType =
    file.type || (ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg')

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, cacheControl: '3600', upsert: false })

  if (error) throw error
  return path
}

export async function getReceiptSignedUrl(
  stored: string | null | undefined,
  expiresSec: number = DEFAULT_TTL_SEC
): Promise<string | null> {
  const path = receiptPathFromStored(stored)
  if (!path) return null

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSec)
  if (error || !data?.signedUrl) {
    console.warn('[receipts] createSignedUrl:', error?.message)
    return null
  }
  return data.signedUrl
}

export async function deleteReceiptObject(stored: string | null | undefined): Promise<void> {
  const path = receiptPathFromStored(stored)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[receipts] remove:', error.message)
}
