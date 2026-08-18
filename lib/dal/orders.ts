import 'server-only'

/**
 * DAL server-only para creación pública de pedidos (Stage 6.1).
 * Usa cliente público (anon) + RPC DEFINER. Sin service role.
 */
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
  buildCreateOrderPayload,
  createOrderErrorFromRpc,
  parseCreateOrderRpcResult,
} from '@/lib/domain/orders/createOrder'
import type { CreateOrderInput, CreateOrderResult } from '@/lib/domain/orders/types'
import { AppError } from '@/lib/domain/errors'
import {
  deriveOrderAccessSecret,
  deriveOrderFollowSecret,
  hashOrderAccessSecret,
} from '@/lib/domain/payments/orderAccess'

export async function createCatalogOrderServer(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  const payload = buildCreateOrderPayload(input)
  let accessCapability: string
  let followToken: string
  try {
    const idem = String(payload.idempotency_key || '')
    accessCapability = await deriveOrderAccessSecret(idem)
    followToken = await deriveOrderFollowSecret(idem)
  } catch {
    throw new AppError('unknown', 'No se pudo registrar el pedido. Intentá de nuevo.', {
      message: 'missing_order_access_secret',
      retryable: true,
    })
  }
  payload.access_capability_hash = await hashOrderAccessSecret(accessCapability)
  payload.follow_token_hash = await hashOrderAccessSecret(followToken)
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc('create_catalog_order', {
    p_payload: payload,
  })

  if (error) {
    throw createOrderErrorFromRpc(error.message || '')
  }
  if (data == null) {
    throw new AppError('unknown', 'No se pudo registrar el pedido. Intentá de nuevo.', {
      message: 'empty_rpc_result',
      retryable: true,
    })
  }
  return {
    ...parseCreateOrderRpcResult(data),
    access_capability: accessCapability,
    follow_token: followToken,
  }
}
