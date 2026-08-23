import type { Metadata } from 'next'
import { PedidoPagoClient } from '@/components/Catalogo/PedidoPagoClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function PedidoPage() {
  return <PedidoPagoClient />
}
