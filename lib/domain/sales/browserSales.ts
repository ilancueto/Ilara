/**
 * Operaciones de ventas del panel (cliente browser + RLS/RPC).
 * No server-only: el POS es deliberadamente client-side con RPC autoritativo.
 */
import { getBrowserSupabase } from '@/lib/supabase/browser'
import {
  buildCreateSalePayload,
  createSaleErrorFromRpc,
  parseCreateSaleRpcResult,
  type CreateSaleInput,
  type CreateSaleResult,
} from '@/lib/domain/sales/createSale'
import { isAppError } from '@/lib/domain/errors'

export type CreateSaleOutcome =
  | { ok: true; result: CreateSaleResult }
  | { ok: false; error: ReturnType<typeof createSaleErrorFromRpc> }

/** Invoca create_sale_with_items con payload validado en superficie. */
export async function createSaleWithItems(input: CreateSaleInput): Promise<CreateSaleOutcome> {
  try {
    const payload = buildCreateSalePayload(input)
    const { data, error } = await getBrowserSupabase().rpc('create_sale_with_items', {
      p_payload: payload,
    })
    if (error) {
      return { ok: false, error: createSaleErrorFromRpc(error.message || '') }
    }
    return { ok: true, result: parseCreateSaleRpcResult(data) }
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err }
    return {
      ok: false,
      error: createSaleErrorFromRpc(err instanceof Error ? err.message : 'unknown'),
    }
  }
}
