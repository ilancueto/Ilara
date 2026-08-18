import type { FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import type { OrderStatus } from '@/lib/domain/orders/states'

export type OrderWhatsAppInput = {
  customerName: string
  orderNumber: string
  status: OrderStatus
  fulfillmentMode: FulfillmentMode
}

function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/).find(Boolean)
  return token || 'hola'
}

export function orderWhatsAppMessage(input: OrderWhatsAppInput): string {
  const name = firstName(input.customerName)
  const number = input.orderNumber.trim()

  if (input.status === 'confirmed' || input.status === 'preparing') {
    return `¡Hola ${name}! Confirmamos tu pedido ${number}. Ya lo estamos preparando.`
  }

  if (input.status === 'ready') {
    if (input.fulfillmentMode === 'retiro') {
      return `¡Hola ${name}! Tu pedido ${number} ya está listo para que pases a retirarlo por el local.`
    }
    return `¡Hola ${name}! Tu pedido ${number} ya está listo. Te avisamos para coordinar la entrega.`
  }

  if (input.status === 'completed') {
    if (input.fulfillmentMode === 'retiro') {
      return `¡Hola ${name}! Tu pedido ${number} ya fue entregado. ¡Gracias por elegir Ilara!`
    }
    return `¡Hola ${name}! Tu pedido ${number} fue despachado. Cualquier consulta, escribinos por acá.`
  }

  if (input.status === 'cancelled') {
    return `¡Hola ${name}! El pedido ${number} quedó cancelado. Si necesitás rearmar uno nuevo, escribinos.`
  }

  return `¡Hola ${name}! Te escribimos por tu pedido ${number}.`
}

export function whatsappContactDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('54')) return digits
  if (digits.length >= 10) return `54${digits}`
  return digits
}
