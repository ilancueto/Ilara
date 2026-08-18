'use server'

/**
 * Server Actions de pedidos de catálogo (Stage 6.1).
 * Creación pública vía DAL + RPC. Sin service role. Sin PII en logs.
 */
import { createCatalogOrderServer } from '@/lib/dal/orders'
import type { CreateOrderInput, CreateOrderResult } from '@/lib/domain/orders/types'
import { setOrderFollowCookie } from '@/lib/domain/orders/followSession'
import { isAppError, toUserMessage } from '@/lib/domain/errors'
import { logStructured, createRequestId } from '@/lib/observability/logger'
import { ObservabilityEvent } from '@/lib/observability/events'

export type CreateCatalogOrderActionResult =
  | { ok: true; order: CreateOrderResult }
  | { ok: false; error: string; code?: string; retryable?: boolean }

export async function createCatalogOrderAction(
  input: CreateOrderInput
): Promise<CreateCatalogOrderActionResult> {
  const requestId = createRequestId()
  const started = Date.now()

  logStructured({
    event: ObservabilityEvent.ORDER_CREATE_STARTED,
    level: 'info',
    requestId,
    route: '/actions/orders',
    meta: {
      lineCount: Array.isArray(input?.lines) ? input.lines.length : 0,
      hasCoupon: Boolean(input?.coupon_code),
    },
  })

  try {
    const order = await createCatalogOrderServer(input)
    if (order.follow_token) {
      await setOrderFollowCookie(order.order_number, order.follow_token)
    }
    logStructured({
      event: ObservabilityEvent.ORDER_CREATE_SUCCEEDED,
      level: 'info',
      requestId,
      route: '/actions/orders',
      durationMs: Date.now() - started,
      meta: {
        orderNumber: order.order_number,
        status: order.status,
        idempotent: order.idempotent_replay,
      },
    })
    return { ok: true, order }
  } catch (err) {
    const code = isAppError(err) ? err.message : 'order_create_failed'
    logStructured({
      event: ObservabilityEvent.ORDER_CREATE_FAILED,
      level: 'warn',
      requestId,
      route: '/actions/orders',
      durationMs: Date.now() - started,
      code: String(code).slice(0, 64),
      meta: {
        appCode: isAppError(err) ? err.code : 'unknown',
      },
    })
    return {
      ok: false,
      error: toUserMessage(err, 'No se pudo crear el pedido. Intentá de nuevo.'),
      code: isAppError(err) ? err.message : undefined,
      retryable: isAppError(err) ? err.retryable : true,
    }
  }
}
