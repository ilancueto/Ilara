import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ConsumeFollowToken } from '@/components/Catalogo/ConsumeFollowToken'
import { PedidoSeguimientoClient } from '@/components/Catalogo/PedidoSeguimientoClient'
import { isOrderNumber } from '@/lib/domain/orders/followLink'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type PageProps = {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ t?: string | string[]; n?: string | string[] }>
}

export default async function PedidoSeguimientoPage({ params, searchParams }: PageProps) {
  const { orderNumber: rawNumber } = await params
  const orderNumber = decodeURIComponent(rawNumber).trim()
  if (!isOrderNumber(orderNumber)) notFound()

  const query = await searchParams
  const notification = Array.isArray(query.n) ? query.n[0] : query.n
  if (notification && notification.trim().length >= 32) {
    return <ConsumeFollowToken orderNumber={orderNumber} token={notification.trim()} mode="notification" />
  }
  const token = Array.isArray(query.t) ? query.t[0] : query.t
  if (token && token.trim().length >= 32) {
    return <ConsumeFollowToken orderNumber={orderNumber} token={token.trim()} />
  }

  return <PedidoSeguimientoClient orderNumber={orderNumber} />
}
