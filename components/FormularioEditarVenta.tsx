'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
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
  const [eligioOtro, setEligioOtro] = useState(false)

  useEffect(() => {
    setSaleDate(venta.sale_date ? format(new Date(venta.sale_date), 'yyyy-MM-dd') : '')
    setCustomerName(venta.customer_name || '')
    setCustomerId(venta.customer_id ?? null)
    setPaymentMethod(venta.payment_method || 'efectivo')
    setNotes(venta.notes || '')
    setReceiptPreview(venta.receipt_url || null)
    setClearReceipt(false)
    setEligioOtro(!!(venta.customer_id == null && (venta.customer_name ?? '').trim() !== ''))
  }, [venta])

  const OTRO_CLIENTE = '__otro__'

  const handleClienteChange = (id: string) => {
    if (id === OTRO_CLIENTE) {
      setCustomerId(null)
      setEligioOtro(true)
      return
    }
    setEligioOtro(false)
    const num = id ? parseInt(id, 10) : null
    setCustomerId(num ?? null)
    if (num) {
      const c = clientes.find((x) => x.id === num)
      if (c) setCustomerName(`${c.first_name} ${c.last_name}`)
    } else {
      setCustomerName('')
    }
  }

  const esNombreLibre = !!(customerName && customerId === null)
  const selectValue = customerId !== null ? String(customerId) : (eligioOtro || esNombreLibre ? OTRO_CLIENTE : '')
  const mostrarInputNombre = selectValue === OTRO_CLIENTE

  const handleNombreOtroChange = (value: string) => {
    setCustomerName(value)
    if (value.trim() === '') setEligioOtro(false)
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

  const modalContent = (
    <>
      <div className="modal-backdrop" onClick={onCancelar} />
      <PastelCard className="fixed left-1/2 -translate-x-1/2 top-8 w-full max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto z-[100] !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700 !p-0 overflow-hidden bg-white dark:bg-gray-900" noHover>
        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-pink-500/10 via-rose-50 to-transparent dark:from-pink-900/20 dark:via-gray-800/80 dark:to-transparent border-b border-pink-100 dark:border-gray-700 px-6 sm:px-8 pt-6 pb-7 sm:pt-8 sm:pb-9">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-pink-500/20 dark:bg-pink-500/30 flex items-center justify-center text-pink-600 dark:text-pink-400 flex-shrink-0">
                <Receipt className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                  Editar venta #{venta.id}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5">Modificá los datos de la venta</p>
              </div>
            </div>
            <button type="button" onClick={onCancelar} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-body p-6 sm:p-8 border-gray-200 dark:border-gray-700">
          {/* Main information: date + client */}
          <section className="form-section">
            <h4 className="form-label text-gray-700 dark:text-gray-300">Información principal</h4>
            <div className="form-section-fields">
              <div className="form-section">
                <label htmlFor="editar-venta-fecha" className="form-label text-gray-700 dark:text-gray-300">Fecha</label>
                <input
                  id="editar-venta-fecha"
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="form-control-h w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 dark:focus:border-pink-500 transition-colors"
                />
              </div>
              <div className="form-section">
                <label htmlFor="editar-venta-cliente" className="form-label text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                  Cliente
                </label>
                <div className="form-section-fields">
                  <select
                    id="editar-venta-cliente"
                    value={selectValue}
                    onChange={(e) => handleClienteChange(e.target.value)}
                    className="form-control-h w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 dark:focus:border-pink-500 transition-colors"
                  >
                    <option value="">Consumidor final</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                    <option value={OTRO_CLIENTE}>Otro (escribir nombre)</option>
                  </select>
                  {mostrarInputNombre && (
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => handleNombreOtroChange(e.target.value)}
                      placeholder="Nombre del cliente"
                      className="form-control-h w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 dark:focus:border-pink-500 transition-colors"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Payment method */}
          <section className="form-section">
            <label className="form-label text-gray-700 dark:text-gray-300">Método de pago</label>
            <div className="form-payment-grid">
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
                    className={`form-payment-btn gap-2 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      active
                        ? 'bg-pink-50 dark:bg-pink-900/40 border-pink-300 dark:border-pink-600 text-pink-600 dark:text-pink-400 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-pink-200 dark:hover:border-pink-700 hover:bg-pink-50/50 dark:hover:bg-pink-900/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Attachment / receipt upload */}
          <section className="form-section">
            <label className="form-label text-gray-700 dark:text-gray-300">Comprobante (opcional)</label>
            <div>
              <input
                type="file"
                id="receipt-venta"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {receiptPreview ? (
                <div className="flex flex-wrap items-center gap-4 p-5 border border-pink-200 dark:border-pink-800 rounded-2xl bg-pink-50 dark:bg-pink-900/30">
                  {receiptPreview.startsWith('data:') || receiptPreview.startsWith('http') ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-gray-700 border border-pink-100 dark:border-transparent flex-shrink-0">
                      {receiptPreview.startsWith('data:') && receiptPreview.includes('image') ? (
                        <Image src={receiptPreview} alt="Preview" width={56} height={56} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-pink-500 dark:text-pink-400">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  ) : null}
                  <span className="text-sm text-pink-700 dark:text-pink-300 flex-1 truncate min-w-0 font-medium">
                    {receiptFile ? receiptFile.name : 'Comprobante adjunto'}
                  </span>
                  <a
                    href={receiptPreview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800 text-xs font-bold transition-colors"
                  >
                    <ExternalLink size={14} />
                    Ver comprobante
                  </a>
                  <button
                    type="button"
                    onClick={handleQuitarComprobante}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 rounded-xl transition-colors"
                    title="Quitar comprobante"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="receipt-venta"
                  className="flex items-center justify-center gap-3 min-h-[88px] py-6 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:border-pink-400 dark:hover:border-pink-500 hover:bg-pink-50/50 dark:hover:bg-pink-900/20 text-gray-500 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 text-sm font-medium transition-colors"
                >
                  <Upload size={20} />
                  Subir comprobante (imagen o PDF)
                </label>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="form-section">
            <label htmlFor="editar-venta-notas" className="form-label text-gray-700 dark:text-gray-300">Notas</label>
            <textarea
              id="editar-venta-notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
              className="form-textarea-min w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 dark:focus:border-pink-500 transition-colors"
            />
          </section>

          {/* Footer actions */}
          <div className="form-footer-bar flex gap-4 border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onCancelar} className="form-control-h flex-1 px-4 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="form-control-h flex-1 px-4 rounded-xl font-semibold text-white bg-pink-500 hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-500 shadow-lg shadow-pink-500/30 dark:shadow-pink-900/30 disabled:opacity-50 transition-all">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </PastelCard>
    </>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
