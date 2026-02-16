'use client'

import { useState, useEffect } from 'react'
import { Venta } from '@/lib/supabase'
import { Cliente } from '@/lib/supabase'
import { updateSale, SaleUpdateData } from '@/lib/saleService'
import { PastelCard } from '@/components/ui/PastelCard'
import { useToast } from '@/context/ToastContext'
import { X, Upload, Trash2, User, Banknote, CreditCard, FileText, ExternalLink, Clock, Receipt } from 'lucide-react'
import { format } from 'date-fns'

interface FormularioEditarVentaProps {
  venta: Venta
  clientes: Cliente[]
  onGuardar: (venta: Venta) => void
  onCancelar: () => void
  guardando: boolean
  setGuardando: (v: boolean) => void
}

export default function FormularioEditarVenta({
  venta,
  clientes,
  onGuardar,
  onCancelar,
  guardando,
  setGuardando,
}: FormularioEditarVentaProps) {
  const { showError } = useToast()
  const [saleDate, setSaleDate] = useState(
    venta.sale_date ? format(new Date(venta.sale_date), 'yyyy-MM-dd') : ''
  )
  const [customerName, setCustomerName] = useState(venta.customer_name || '')
  const [customerId, setCustomerId] = useState<number | null>(venta.customer_id ?? null)
  const [paymentMethod, setPaymentMethod] = useState(venta.payment_method || 'efectivo')
  const [notes, setNotes] = useState(venta.notes || '')
  const [receiptFile, setReceiptFile] = useState<File | undefined>()
  const [receiptPreview, setReceiptPreview] = useState<string | null>(venta.receipt_url || null)
  const [clearReceipt, setClearReceipt] = useState(false)

  useEffect(() => {
    setSaleDate(venta.sale_date ? format(new Date(venta.sale_date), 'yyyy-MM-dd') : '')
    setCustomerName(venta.customer_name || '')
    setCustomerId(venta.customer_id ?? null)
    setPaymentMethod(venta.payment_method || 'efectivo')
    setNotes(venta.notes || '')
    setReceiptPreview(venta.receipt_url || null)
    setClearReceipt(false)
  }, [venta])

  const handleClienteChange = (id: string) => {
    const num = id ? parseInt(id, 10) : null
    setCustomerId(num)
    if (num) {
      const c = clientes.find((x) => x.id === num)
      if (c) setCustomerName(`${c.first_name} ${c.last_name}`)
    } else {
      setCustomerName('')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      setClearReceipt(false)
      const reader = new FileReader()
      reader.onloadend = () => setReceiptPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleQuitarComprobante = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setReceiptFile(undefined)
    setReceiptPreview(null)
    setClearReceipt(!!venta.receipt_url)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const data: SaleUpdateData = {
        sale_date: saleDate ? new Date(saleDate).toISOString() : undefined,
        customer_name: customerName.trim() || null,
        customer_id: customerId,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        receipt: receiptFile,
        clearReceipt: clearReceipt || undefined,
      }
      const updated = await updateSale(venta.id, data)
      onGuardar(updated)
    } catch (err: unknown) {
      console.error('Error al actualizar venta:', err)
      const e = err as Error & { code?: string; updated?: Venta }
      if (e.code === 'RECEIPT_COLUMN_MISSING' && e.updated) {
        onGuardar(e.updated)
        showError(
          'La venta se guardó, pero el comprobante no (falta la columna receipt_url). En Supabase → SQL Editor ejecutá: ALTER TABLE sales ADD COLUMN receipt_url TEXT;'
        )
      } else {
        showError('No se pudo actualizar la venta. Revisá los datos e intentá de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onCancelar} />
      <PastelCard className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 z-[100] !shadow-2xl" noHover>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            Editar venta #{venta.id}
          </h3>
          <button type="button" onClick={onCancelar} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="form-label">Fecha</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800"
            />
          </div>

          <div>
            <label className="form-label flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-pink-500" />
              Cliente
            </label>
            <select
              value={customerId ?? ''}
              onChange={(e) => handleClienteChange(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800"
            >
              <option value="">Consumidor final</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="O escribir nombre"
              className="w-full mt-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="form-label">Método de pago</label>
            <div className="flex gap-2 mt-1">
              {[
                { id: 'efectivo', icon: Banknote, label: 'Efectivo' },
                { id: 'tarjeta', icon: CreditCard, label: 'Tarjeta' },
                { id: 'transferencia', icon: FileText, label: 'Transf.' },
                { id: 'credito', icon: Clock, label: 'A crédito' },
                { id: 'mixto', icon: Receipt, label: 'Varios' },
              ].map((m) => {
                const Icon = m.icon
                const active = paymentMethod === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                      active
                        ? 'bg-pink-50 border-pink-300 text-pink-600'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-pink-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="form-label">Comprobante (opcional)</label>
            <div className="mt-1">
              <input
                type="file"
                id="receipt-venta"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {receiptPreview ? (
                <div className="flex flex-wrap items-center gap-3 p-3 border border-pink-200 rounded-xl bg-pink-50">
                  {receiptPreview.startsWith('data:') || receiptPreview.startsWith('http') ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-pink-100 flex-shrink-0">
                      {receiptPreview.startsWith('data:') && receiptPreview.includes('image') ? (
                        <img src={receiptPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-pink-500">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  ) : null}
                  <span className="text-sm text-pink-700 flex-1 truncate min-w-0">
                    {receiptFile ? receiptFile.name : 'Comprobante adjunto'}
                  </span>
                  <a
                    href={receiptPreview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-100 text-pink-700 hover:bg-pink-200 text-xs font-bold transition-colors"
                  >
                    <ExternalLink size={14} />
                    Ver comprobante
                  </a>
                  <button
                    type="button"
                    onClick={handleQuitarComprobante}
                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                    title="Quitar comprobante"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="receipt-venta"
                  className="flex items-center justify-center gap-2 p-4 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-pink-300 hover:bg-pink-50/50 text-gray-400 hover:text-pink-500 text-sm"
                >
                  <Upload size={18} />
                  Subir comprobante (imagen o PDF)
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
              className="w-full mt-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onCancelar} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </PastelCard>
    </>
  )
}
