// Servicio para actualizar ventas (historial) y subir comprobantes
import { supabase } from '@/lib/supabase'
import { Venta } from '@/lib/supabase'

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
  if (!file || file.size === 0) throw new Error('El archivo está vacío o no es válido.')
  const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ext = rawExt || 'jpg'
  const fileName = `sale-${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`
  const contentType = file.type || (ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg')

  const { error } = await supabase.storage
    .from('receipts')
    .upload(fileName, file, { contentType, cacheControl: '3600', upsert: false })

  if (error) throw error
  const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
  return data.publicUrl
}

export async function updateSale(id: number, data: SaleUpdateData): Promise<Venta> {
  let receiptUrl: string | undefined

  if (data.receipt) {
    receiptUrl = await uploadReceipt(data.receipt)
  }

  const updatePayload: Record<string, unknown> = {}
  if (data.sale_date !== undefined) updatePayload.sale_date = data.sale_date
  if (data.customer_name !== undefined) updatePayload.customer_name = data.customer_name
  if (data.customer_id !== undefined) updatePayload.customer_id = data.customer_id
  if (data.payment_method !== undefined) updatePayload.payment_method = data.payment_method
  if (data.notes !== undefined) updatePayload.notes = data.notes
  if (data.clearReceipt) updatePayload.receipt_url = null
  else if (receiptUrl !== undefined) updatePayload.receipt_url = receiptUrl

  const { data: updated, error } = await supabase
    .from('sales')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Columna receipt_url no existe: guardamos el resto y avisamos
    if (error.code === 'PGRST204' && receiptUrl !== undefined) {
      try {
        const path = receiptUrl.split('/').pop()
        if (path) await supabase.storage.from('receipts').remove([path])
      } catch (_) {}
      const fallbackPayload = { ...updatePayload }
      delete fallbackPayload.receipt_url
      const { data: fallbackUpdated, error: fallbackError } = await supabase
        .from('sales')
        .update(fallbackPayload)
        .eq('id', id)
        .select()
        .single()
      if (!fallbackError && fallbackUpdated) {
        const err = new Error('La venta se actualizó, pero no se pudo guardar el comprobante. Agregá la columna receipt_url en la tabla sales.') as Error & { code?: string; updated?: Venta }
        err.code = 'RECEIPT_COLUMN_MISSING'
        ;(err as Error & { updated: Venta }).updated = fallbackUpdated as Venta
        throw err
      }
    }
    if (receiptUrl) {
      try {
        const path = receiptUrl.split('/').pop()
        if (path) await supabase.storage.from('receipts').remove([path])
      } catch (_) {}
    }
    throw error
  }

  return updated
}

/** Elimina una venta y devuelve el stock de los productos a su estado anterior */
export async function deleteSale(saleId: number): Promise<void> {
  const { data: items, error: errItems } = await supabase
    .from('sale_items')
    .select('product_id, quantity')
    .eq('sale_id', saleId)

  if (errItems) throw errItems

  const { data: sale, error: errSale } = await supabase
    .from('sales')
    .select('receipt_url')
    .eq('id', saleId)
    .single()

  if (errSale || !sale) throw errSale || new Error('Venta no encontrada')

  for (const item of items || []) {
    if (item.product_id == null) continue
    const { data: product, error: errProd } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.product_id)
      .single()
    if (errProd || product == null) continue
    const newStock = (product.stock ?? 0) + item.quantity
    await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.product_id)
  }

  await supabase.from('sale_items').delete().eq('sale_id', saleId)
  const { error: errDelete } = await supabase.from('sales').delete().eq('id', saleId)
  if (errDelete) throw errDelete

  if (sale.receipt_url) {
    try {
      const path = sale.receipt_url.split('/').pop()
      if (path) await supabase.storage.from('receipts').remove([path])
    } catch (_) {}
  }
}
