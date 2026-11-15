/**
 * Instrumentación del navegador (Next.js). Sólo precarga Sentry cuando hay DSN
 * y el navegador está libre; sin DSN no hace nada.
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md
 */
import { warmSentry } from '@/lib/observability/sentry'

warmSentry()
