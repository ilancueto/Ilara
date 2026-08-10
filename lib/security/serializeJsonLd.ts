/**
 * Serializa un objeto JSON-LD de forma segura para insertarlo en <script>.
 * Next.js docs: reemplazar `<` por `\u003c` para evitar cierre de script (XSS).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
