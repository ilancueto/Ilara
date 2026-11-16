'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, UserPlus } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { panelHref } from '@/lib/appNavigation'
import { toUserMessage } from '@/lib/domain/errors'
import { orderStatusLabel } from '@/lib/domain/orders/states'
import { orderWhatsAppMessage, whatsappContactDigits } from '@/lib/domain/orders/orderWhatsApp'
import type { OrderDetail } from '@/lib/domain/orders/types'
import { findOrCreateCustomerFromContact } from '@/lib/domain/customers/browserCustomers'
import { catalogReturnLabel, catalogRefundActionLabel } from '@/lib/domain/returns/rules'
import { formatPesoAR, formatPesoARExact } from '@/lib/formatPesoAR'
import { buildWhatsAppUrlTo } from '@/lib/whatsappLink'
import { actorLabel } from './pedidoUi'

/** Datos de contacto y fechas del pedido; permite registrar a la clienta si aún no existe. */
export function PedidoDatosContacto({ detail }: { detail: OrderDetail }) {
  const { showToast } = useToast()
  const router = useRouter()
  const [registeringCustomer, setRegisteringCustomer] = useState(false)
  return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-hint text-xs">Clienta</dt>
          <dd className="font-semibold">
            {detail.customer_id ? (
              <a
                href={panelHref({ tab: 'customers', customerId: detail.customer_id })}
                className="text-accent underline-offset-2 hover:underline"
                data-testid="pedido-open-customer"
              >
                {detail.customer_name}
              </a>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                {detail.customer_name}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-pink-200 px-2 py-1 text-xs font-bold text-pink-700 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-300"
                  disabled={registeringCustomer}
                  data-testid="pedido-register-customer"
                  onClick={() => {
                    void (async () => {
                      setRegisteringCustomer(true)
                      try {
                        const created = await findOrCreateCustomerFromContact({
                          name: detail.customer_name,
                          phone: detail.customer_phone,
                          email: detail.customer_email,
                        })
                        router.push(panelHref({ tab: 'customers', customerId: created.id }), { scroll: false })
                      } catch (err) {
                        showToast('error', toUserMessage(err, 'No se pudo registrar a la clienta.'))
                      } finally {
                        setRegisteringCustomer(false)
                      }
                    })()
                  }}
                >
                  <UserPlus size={14} aria-hidden />
                  Registrar como clienta
                </button>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-hint text-xs">Teléfono</dt>
          <dd className="font-semibold flex flex-wrap items-center gap-2">
            <span>{detail.customer_phone}</span>
            {(() => {
              const url = buildWhatsAppUrlTo(
                whatsappContactDigits(detail.customer_phone),
                orderWhatsAppMessage({
                  customerName: detail.customer_name,
                  orderNumber: detail.order_number,
                  status: detail.status,
                  fulfillmentMode: detail.fulfillment_mode,
                })
              )
              return url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-2 py-1 text-xs font-bold text-success hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                  data-testid="pedido-whatsapp"
                >
                  <MessageCircle size={14} aria-hidden />
                  WhatsApp
                </a>
              ) : null
            })()}
          </dd>
        </div>
        {detail.customer_email && (
          <div>
            <dt className="text-hint text-xs">Email</dt>
            <dd className="font-semibold break-all">{detail.customer_email}</dd>
          </div>
        )}
        <div>
          <dt className="text-hint text-xs">Creado</dt>
          <dd>{new Date(detail.created_at).toLocaleString('es-AR')}</dd>
        </div>
        <div>
          <dt className="text-hint text-xs">Actualizado</dt>
          <dd>{new Date(detail.updated_at).toLocaleString('es-AR')}</dd>
        </div>
        {detail.coupon_code && (
          <div>
            <dt className="text-hint text-xs">Cupón</dt>
            <dd>
              {detail.coupon_code} (−{detail.coupon_discount_percentage ?? 0}%)
            </dd>
          </div>
        )}
      </dl>
  )
}

/** Cotización de envío o modalidad de retiro/coordinación. */
export function PedidoEnvio({ detail }: { detail: OrderDetail }) {
  return (
        <div className="rounded-xl bg-pink-50 dark:bg-pink-950/20 px-3 py-2 text-sm">
          <p className="text-xs text-hint mb-1">
            {detail.fulfillment_mode === 'retiro'
              ? 'Retiro en el local'
              : detail.fulfillment_mode === 'coordinar'
                ? 'Entrega a coordinar'
                : 'Envío cotizado'}
          </p>
          {detail.fulfillment_mode === 'envio' ? (
            <>
              <p className="font-semibold">
                {detail.shipping_carrier_description} · {detail.shipping_service_description}
              </p>
              {detail.shipping_destination_street && detail.shipping_destination_number ? (
                <div className="space-y-0.5">
                  <p><span className="text-muted">Dirección:</span> {detail.shipping_destination_street} {detail.shipping_destination_number}</p>
                  <p><span className="text-muted">Localidad:</span> {detail.shipping_destination_city}, {detail.shipping_destination_state}</p>
                  <p><span className="text-muted">Código postal:</span> {detail.shipping_destination_postal_code}</p>
                </div>
              ) : (
                <p>
                  {detail.shipping_destination_formatted_address
                    || `CP ${detail.shipping_destination_postal_code}, ${detail.shipping_destination_city}, ${detail.shipping_destination_state}`}
                </p>
              )}
              <p>
                ${formatPesoARExact(detail.shipping_amount)}
                {detail.shipping_delivery_estimate ? ` · ${detail.shipping_delivery_estimate}` : ''}
              </p>
            </>
          ) : (
            <p className="font-semibold">
              {detail.fulfillment_mode === 'retiro'
                ? 'Pasás a buscarlo. Coordinamos el horario por WhatsApp.'
                : 'Si estás cerca, lo vemos por WhatsApp.'}
              {detail.shipping_destination_formatted_address
                ? ` · ${detail.shipping_destination_formatted_address}`
                : ''}
            </p>
          )}
        </div>
  )
}

/** Devoluciones registradas contra el pedido. */
export function PedidoDevoluciones({ items }: { items: OrderDetail['returns'] }) {
  return (
        <div data-testid="pedido-returns">
          <h4 className="text-sm font-bold mb-2">Devoluciones</h4>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-line px-3 py-2 text-sm"
              >
                <p className="font-semibold">
                  {catalogReturnLabel(item.return_number)} · ${formatPesoAR(item.refund_total)}
                </p>
                <p className="text-xs text-muted">
                  {catalogRefundActionLabel(item.refund_action)}
                  {item.restock ? ' · stock reintegrado' : ' · sin reintegro de stock'}
                </p>
                <p className="text-xs text-muted mt-1">{item.reason}</p>
              </li>
            ))}
          </ul>
        </div>
  )
}

/** Líneas del pedido y totales. */
export function PedidoLineas({ detail }: { detail: OrderDetail }) {
  return (
      <div>
        <h4 className="text-sm font-bold mb-2">Líneas</h4>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-line">
          {detail.items.map((it) => (
            <li key={it.id} className="px-3 py-2 text-sm flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {it.name_snapshot}{' '}
                  <span className="text-hint font-normal">×{it.quantity}</span>
                </p>
                {it.variant_snapshot && (
                  <p className="text-xs text-hint">{it.variant_snapshot}</p>
                )}
                {it.line_type === 'combo' && it.combo_components_snapshot.length > 0 && (
                  <p className="text-xs text-hint mt-0.5">
                    {it.combo_components_snapshot
                      .map((c) => `${c.product_name}×${c.quantity}`)
                      .join(', ')}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">${formatPesoAR(it.line_subtotal)}</p>
                <p className="text-xs text-hint">
                  ${formatPesoAR(it.unit_price)} c/u
                  {it.discount_percentage > 0 ? ` (−${it.discount_percentage}%)` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 text-sm space-y-0.5 text-right">
          <p>
            Subtotal: <strong>${formatPesoAR(detail.subtotal)}</strong>
          </p>
          {detail.discount_total > 0 && (
            <p>
              Descuento: <strong>−${formatPesoAR(detail.discount_total)}</strong>
            </p>
          )}
          {detail.shipping_amount > 0 && (
            <p>
              Envío: <strong>${formatPesoARExact(detail.shipping_amount)}</strong>
            </p>
          )}
          <p className="text-base">
            Total: <strong>${formatPesoARExact(detail.total)}</strong>
          </p>
        </div>
      </div>
  )
}

/** Historial de cambios de estado. */
export function PedidoHistorial({ events }: { events: OrderDetail['events'] }) {
  return (
      <div>
        <h4 className="text-sm font-bold mb-2">Historial de estados</h4>
        <ol className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="text-xs sm:text-sm flex gap-2 text-muted"
            >
              <span className="text-hint shrink-0">
                {new Date(ev.created_at).toLocaleString('es-AR')}
              </span>
              <span>
                {ev.from_status
                  ? `${orderStatusLabel(ev.from_status)} → ${orderStatusLabel(ev.to_status)}`
                  : orderStatusLabel(ev.to_status)}
                {ev.reason ? ` · ${ev.reason}` : ''}
                <span className="text-hint"> · {actorLabel(ev.actor_kind)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
  )
}

type CancelFormProps = {
  reason: string
  onReasonChange: (value: string) => void
  error: string | null
  loading: boolean
  onConfirm: () => void
  onBack: () => void
}

/** Formulario de motivo para cancelar un pedido. */
export function PedidoCancelarForm({ reason, onReasonChange, error, loading, onConfirm, onBack }: CancelFormProps) {
  return (
        <div
          className="rounded-xl border border-danger-line bg-danger-soft p-3 space-y-2"
          data-testid="pedido-cancel-form"
        >
          <label
            htmlFor="pedido-cancel-reason"
            className="block text-xs font-bold text-danger"
          >
            Motivo de cancelación *
          </label>
          <textarea
            id="pedido-cancel-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            maxLength={300}
            rows={2}
            className="w-full rounded-lg border border-danger-line bg-surface px-2 py-1.5 text-sm"
            data-testid="pedido-cancel-reason"
            disabled={loading}
          />
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-rose-600 text-white px-3 py-2 text-sm font-bold disabled:opacity-60"
              disabled={loading}
              onClick={onConfirm}
              data-testid="pedido-cancel-confirm"
            >
              Confirmar cancelación
            </button>
            <button
              type="button"
              className="rounded-xl border border-line px-3 py-2 text-sm font-semibold"
              disabled={loading}
              onClick={onBack}
            >
              Volver
            </button>
          </div>
        </div>
  )
}
