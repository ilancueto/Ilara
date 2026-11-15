import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { captureToSentry, isSentryEnabled, scrubSentryEvent } from '@/lib/observability/sentry'
import { readSentryDsn, sentryIngestOrigin } from '@/lib/observability/sentryDsn'
import { ObservabilityEvent } from '@/lib/observability/events'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Sentry opt-in', () => {
  it('queda desactivado en tests aunque haya DSN', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1')
    expect(isSentryEnabled()).toBe(false)
  })

  it('captureToSentry no hace nada (ni lanza) cuando está desactivado', () => {
    expect(() =>
      captureToSentry(new Error('boom'), { event: ObservabilityEvent.SERVER_ERROR, level: 'error' })
    ).not.toThrow()
  })

  it('lee el DSN del servidor o del cliente y descarta vacíos', () => {
    expect(readSentryDsn({})).toBeUndefined()
    expect(readSentryDsn({ SENTRY_DSN: '  ' })).toBeUndefined()
    expect(readSentryDsn({ NEXT_PUBLIC_SENTRY_DSN: 'https://a@b.ingest.sentry.io/1' })).toBe(
      'https://a@b.ingest.sentry.io/1'
    )
    expect(
      readSentryDsn({ SENTRY_DSN: 'https://s@b.ingest.sentry.io/2', NEXT_PUBLIC_SENTRY_DSN: 'https://c@b.ingest.sentry.io/1' })
    ).toBe('https://s@b.ingest.sentry.io/2')
  })

  it('el CSP sólo agrega el origen https de ingesta, sin la clave', () => {
    expect(sentryIngestOrigin('https://abc123@o99.ingest.us.sentry.io/456')).toBe('https://o99.ingest.us.sentry.io')
    expect(sentryIngestOrigin('http://abc@insecure.example/1')).toBeUndefined()
    expect(sentryIngestOrigin('no-es-una-url')).toBeUndefined()
    expect(sentryIngestOrigin(undefined)).toBeUndefined()
  })
})

describe('scrubSentryEvent', () => {
  it('elimina usuario, cookies, headers, query string y breadcrumbs', () => {
    const event = {
      type: undefined,
      user: { id: '1', email: 'clienta@example.com', ip_address: '1.2.3.4' },
      request: {
        url: 'https://ilara.com.ar/pedido?follow=secreto',
        headers: { cookie: 'sb-access-token=abc' },
        cookies: { a: 'b' },
        query_string: 'follow=secreto',
        data: { customer_phone: '1158492310' },
      },
      breadcrumbs: [{ message: 'click', data: { email: 'x@y.com' } }],
    } as unknown as ErrorEvent

    const scrubbed = scrubSentryEvent(event)
    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.request).toEqual({ url: 'https://ilara.com.ar/pedido' })
    expect(scrubbed.breadcrumbs).toBeUndefined()
    expect(JSON.stringify(scrubbed)).not.toMatch(/secreto|clienta@|sb-access-token|1158492310/)
  })

  it('redacta datos personales en el mensaje y en la excepción', () => {
    const event = {
      type: undefined,
      message: 'Fallo para clienta@example.com',
      exception: { values: [{ type: 'Error', value: 'No se pudo notificar a clienta@example.com' }] },
    } as unknown as ErrorEvent

    const scrubbed = scrubSentryEvent(event)
    expect(scrubbed.message).toBe('[REDACTED]')
    expect(scrubbed.exception?.values?.[0]?.value).toBe('[REDACTED]')
  })
})
