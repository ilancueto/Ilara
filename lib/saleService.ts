// Servicio para actualizar ventas (historial) y subir comprobantes
import { supabase, getUser } from '@/lib/supabase'
import { Venta } from '@/lib/supabase'
import { deleteReceiptObject, getReceiptSignedUrl, uploadReceiptFile } from '@/lib/receiptStorage'

export type SaleUpdateData = {
  sale_date?: string
  customer_name?: string | null
  customer_id?: number | null
  payment_method?: string
  notes?: string | null
  receipt?: File
  /** true = quitar comprobante guardado */
  clearReceipt?: boolean
}

async function uploadReceipt(file: File): Promise<string> {
  return uploadReceiptFile(file, 'sale')
}

/** URL temporal para ver/descargar comprobante (bucket privado). */
export async function getSaleReceiptViewUrl(venta: Pick<Venta, 'receipt_url'>): Promise<string | null> {
  return getReceiptSignedUrl(venta.receipt_url)
}

export async function updateSale(id: number, data: SaleUpdateData): Promise<Venta> {
  let receiptPath: string | undefined

  if (data.receipt) {
    receiptPath = await uploadReceipt(data.receipt)
  }

  const updatePayload: Record<string, unknown> = {}
  if (data.sale_date !== undefined) updatePayload.sale_date = data.sale_date
  if (data.customer_name !== undefined) updatePayload.customer_name = data.customer_name
  if (data.customer_id !== undefined) updatePayload.customer_id = data.customer_id
  if (data.payment_method !== undefined) updatePayload.payment_method = data.payment_method
  if (data.notes !== undefined) updatePayload.notes = data.notes
  if (data.clearReceipt) updatePayload.receipt_url = null
  else if (receiptPath !== undefined) updatePayload.receipt_url = receiptPath

  const user = await getUser()
  if (user?.id) updatePayload.updated_by = user.id

  const { data: updated, error } = await supabase
    .from('sales')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST204' && receiptPath !== undefined) {
      try {
        await deleteReceiptObject(receiptPath)
      } catch {
        /* ignore */
      }
      const fallbackPayload = { ...updatePayload } as Record<string, unknown>
      delete fallbackPayload.receipt_url
      const { data: fallbackUpdated, error: fallbackError } = await supabase
        .from('sales')
        .update(fallbackPayload)
        .eq('id', id)
        .select()
        .single()
      if (!fallbackError && fallbackUpdated) {
        const err = new Error(
          'La venta se actualizó, pero no se pudo guardar el comprobante. Agregá la columna receipt_url en la tabla sales.'
        ) as Error & { code?: string; updated?: Venta }
        err.code = 'RECEIPT_COLUMN_MISSING'
        ;(err as Error & { updated: Venta }).updated = fallbackUpdated as Venta
        throw err
      }
    }
    if (receiptPath) {
      try {
        await deleteReceiptObject(receiptPath)
      } catch {
        /* ignore */
      }
    }
    throw error
  }

  return updated
}

type DeleteSaleRpcResult = {
  receipt_stored?: string | null
  ok?: boolean
}

/** Elimina una venta y devuelve el stock (atómico en DB vía RPC). Limpia el archivo de comprobante si existe. */
export async function deleteSale(saleId: number): Promise<void> {
  const { data, error } = await supabase.rpc('delete_sale_and_restore_stock', {
    p_sale_id: saleId,
  })

  if (error) throw error

  const payload = data as DeleteSaleRpcResult | null
  const stored = payload?.receipt_stored
  if (stored != null && String(stored).length > 0) {
    await deleteReceiptObject(String(stored))
  }
}
