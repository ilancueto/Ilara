import { WHATSAPP_NUMBER } from '@/lib/config'

export function whatsappPhoneDigits(): string {
  return WHATSAPP_NUMBER.replace(/\D/g, '')
}

/**
 * Enlace wa.me con el texto UTF-8 codificado. Si el mensaje se concatena en la query sin
 * encodeURIComponent, Chrome (y otros) pueden generar una URL inválida (&, #, ?, tildes, etc.).
 */
export function buildWhatsAppUrl(plainText: string): string | null {
  const phone = whatsappPhoneDigits()
  if (!phone) return null
  return `https://wa.me/${phone}?text=${encodeURIComponent(plainText)}`
}

/**
 * Abre WhatsApp de forma compatible con Chrome:
 * - `newTab: false` → misma pestaña (`location.assign`, no depende de popups).
 * - `newTab: true` → `<a target="_blank">` programático (mejor que `window.open` con flags).
 */
export function openWhatsApp(plainText: string, newTab = false): boolean {
  const url = buildWhatsAppUrl(plainText)
  if (!url) return false
  if (newTab) {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  }
  window.location.assign(url)
  return true
}
