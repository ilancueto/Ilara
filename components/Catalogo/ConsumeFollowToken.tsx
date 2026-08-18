'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { claimFollowSessionAction } from '@/app/actions/payments'
import { buildOrderFollowCleanPath } from '@/lib/domain/orders/followLink'

type Props = {
  orderNumber: string
  token: string
}

export function ConsumeFollowToken({ orderNumber, token }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void claimFollowSessionAction(orderNumber, token).then((result) => {
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
  }, [orderNumber, token, router])

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-gray-900 dark:text-zinc-50">
        <p className="text-sm uppercase tracking-widest text-pink-600">Tu pedido</p>
        <h1 className="mt-2 text-3xl font-extrabold">{orderNumber}</h1>
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          {error}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-gray-900 dark:text-zinc-50">
      <p className="text-sm text-gray-500">Abriendo tu pedido…</p>
    </main>
  )
}
