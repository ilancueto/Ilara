'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { claimFollowSessionAction, claimNotificationSessionAction } from '@/app/actions/payments'
import { buildOrderFollowCleanPath } from '@/lib/domain/orders/followLink'

type Props = {
  orderNumber: string
  token: string
  mode?: 'follow' | 'notification'
}

export function ConsumeFollowToken({ orderNumber, token, mode = 'follow' }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const claim = mode === 'notification' ? claimNotificationSessionAction : claimFollowSessionAction
    void claim(orderNumber, token).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.replace(buildOrderFollowCleanPath(orderNumber))
    })
    return () => {
      cancelled = true
    }
  }, [mode, orderNumber, token, router])

  if (error) {
    return (
      <main className="storefront mx-auto max-w-xl px-4 py-10">
        <p>Tu pedido</p>
        <h1 className="mt-2">{orderNumber}</h1>
        <p className="mt-4 rounded-xl px-4 py-3 text-sm" role="alert" style={{ background: '#F6E6E8', color: '#A51D27' }}>
          {error}
        </p>
        <p className="mt-4"><Link href="/pedido">Recuperar pedido</Link> · <Link href="/catalogo">Volver al catálogo</Link></p>
      </main>
    )
  }

  return (
    <main className="storefront mx-auto max-w-xl px-4 py-10">
      <p>Abriendo tu pedido…</p>
    </main>
  )
}
