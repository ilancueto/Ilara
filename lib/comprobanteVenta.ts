/**
 * Genera e imprime un comprobante de pago para entregar al cliente.
 * Se usa después de una venta (Punto de venta) o desde el historial de ventas.
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type ComprobanteVenta = {
  id: number
  total: number
  customer_name: string | null
  payment_method: string | null
  payment_breakdown?: { method: string; amount: number }[] | null
  notes?: string | null
  sale_date?: string
  created_at: string
}

export type ComprobanteItem = {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

function getPaymentLabel(metodo: string | null): string {
  switch (metodo) {
    case 'efectivo': return 'Efectivo'
    case 'tarjeta': return 'Tarjeta'
    case 'transferencia': return 'Transferencia'
    case 'credito': return 'A crédito'
    case 'mixto': return 'Varios'
    default: return 'N/A'
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Abre una ventana con el comprobante listo para imprimir (o guardar PDF).
 * Devuelve true si se abrió la ventana, false si el navegador bloqueó el popup.
 */
export function imprimirComprobante(venta: ComprobanteVenta, items: ComprobanteItem[]): boolean {
  const fecha = format(
    new Date(venta.sale_date || venta.created_at),
    "d 'de' MMMM yyyy, HH:mm",
    { locale: es }
  )
  const tieneDesglose = venta.payment_breakdown && venta.payment_breakdown.length > 0
  const metodoPago = tieneDesglose
    ? venta.payment_breakdown!
        .map(p => `${getPaymentLabel(p.method)}: $${p.amount.toLocaleString()}`)
        .join(' | ')
    : getPaymentLabel(venta.payment_method)

  const itemsRows = items
    .map(
      (item, i) =>
        `<tr class="row-${i % 2 === 0 ? 'even' : 'odd'}"><td class="cell-product">${escapeHtml(item.product_name)}</td><td class="cell-qty">${item.quantity}</td><td class="cell-price">$${item.unit_price.toLocaleString()}</td><td class="cell-subtotal">$${item.subtotal.toLocaleString()}</td></tr>`
    )
    .join('')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const logoUrl = `${origin}/logo_icon.png`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Comprobante #${venta.id}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 14px;
      max-width: 340px;
      margin: 0 auto;
      padding: 0;
      color: #374151;
      background: #fdf2f8;
    }
    .receipt {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(236, 72, 153, 0.12);
      margin: 20px auto;
    }
    .header {
      background: linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%);
      color: #fff;
      padding: 20px 20px 24px;
      text-align: center;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 4px;
      letter-spacing: 0.02em;
    }
    .header .sub {
      font-size: 12px;
      opacity: 0.95;
      font-weight: 500;
    }
    .header .receipt-logo {
      height: 52px;
      width: auto;
      margin-bottom: 10px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.25);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 12px;
      letter-spacing: 0.05em;
    }
    .body { padding: 20px; }
    .meta {
      color: #9ca3af;
      font-size: 12px;
      margin-bottom: 16px;
      text-align: center;
    }
    .field {
      margin-bottom: 10px;
      padding: 10px 14px;
      background: #fdf2f8;
      border-radius: 10px;
      border-left: 3px solid #ec4899;
    }
    .field-label { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .field-value { font-size: 14px; color: #1f2937; font-weight: 500; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 13px;
    }
    thead th {
      text-align: left;
      padding: 10px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #fff;
      background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%);
    }
    thead th:last-child { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    tbody td { padding: 10px 8px; border-bottom: 1px solid #fce7f3; }
    tbody tr.row-even { background: #fffbff; }
    tbody tr.row-odd { background: #fff; }
    .cell-product { font-weight: 500; color: #374151; }
    .cell-qty { text-align: center; color: #6b7280; }
    .cell-price { color: #6b7280; }
    .cell-subtotal { text-align: right; font-weight: 600; color: #1f2937; }
    .total-wrap {
      margin-top: 16px;
      padding: 14px 16px;
      background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
      border-radius: 12px;
      border: 2px solid #f9a8d4;
      text-align: right;
    }
    .total-label { font-size: 11px; color: #be185d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .total-amount { font-size: 22px; font-weight: 800; color: #9d174d; margin-top: 2px; }
    .notes {
      margin-top: 16px;
      padding: 12px 14px;
      background: #fffbeb;
      border-radius: 10px;
      border-left: 3px solid #f59e0b;
      font-size: 13px;
      color: #92400e;
    }
    .notes strong { color: #b45309; }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      padding: 16px 20px;
      margin-top: 8px;
    }
    .print-tip {
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      padding: 8px 12px;
      margin: 0 20px 12px;
      background: #f3f4f6;
      border-radius: 8px;
    }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #fff; margin: 0; padding: 8px; }
      .receipt { box-shadow: none; border: 1px solid #fce7f3; }
      .print-tip { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="print-tip">Para que salga con colores al imprimir, activá <strong>«Gráficos de fondo»</strong> en la ventana de impresión.</p>
  <div class="receipt">
    <div class="header">
      <img src="${logoUrl}" alt="Ilara Beauty" class="receipt-logo" />
      <h1>Ilara Beauty</h1>
      <p class="sub">Comprobante de venta</p>
      <span class="badge">#${venta.id} · ${fecha}</span>
    </div>
    <div class="body">
      <div class="field">
        <div class="field-label">Cliente</div>
        <div class="field-value">${escapeHtml(venta.customer_name || 'Consumidor final')}</div>
      </div>
      <div class="field">
        <div class="field-label">Forma de pago</div>
        <div class="field-value">${escapeHtml(metodoPago)}</div>
      </div>
      <table>
        <thead><tr><th>Producto</th><th>Cant</th><th>P. unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="total-wrap">
        <div class="total-label">Total</div>
        <div class="total-amount">$${venta.total.toLocaleString()}</div>
      </div>
      ${venta.notes ? `<div class="notes"><strong>Notas:</strong> ${escapeHtml(venta.notes)}</div>` : ''}
    </div>
    <div class="footer">Gracias por tu compra · Ilara Beauty</div>
  </div>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) return false

  w.document.write(html)
  w.document.close()
  w.focus()
  w.onload = () => {
    w.print()
    w.onafterprint = () => w.close()
  }
  return true
}
