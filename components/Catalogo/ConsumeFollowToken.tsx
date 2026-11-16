'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { claimFollowSessionAction, claimNotificationSessionAction } from '@/app/actions/payments'
import { buildOrderFollowCleanPath } from '@/lib/domain/orders/followLink'
import { clearOrderAccess } from '@/lib/domain/payments/publicSession'
import { openWhatsApp } from '@/lib/whatsappLink'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import styles from '@/components/storefront/storefront.module.css'

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
        // El link guardado ya no sirve: lo olvidamos para que "Seguir mi pedido" no vuelva a traer acá.
        clearOrderAccess(orderNumber)
        setError(result.error)
        return
      }
      router.replace(buildOrderFollowCleanPath(orderNumber))
    })
    return () => {
      cancelled = true
    }
  }, [mode, orderNumber, token, router])

  return (
    <StorefrontShell header={<StorefrontHeader simple />}>
      <main className={`${styles.center} ${styles.wrap}`}>
        <section className={styles.box} aria-labelledby="pedido-link-titulo" aria-busy={!error}>
          <p className={styles.eyebrow}>Tu pedido</p>
          <h1 id="pedido-link-titulo" className="mt-2 text-3xl">{orderNumber}</h1>
          {error ? (
            <>
              <p className="mt-4 rounded-2xl border border-danger-line bg-danger-soft p-3.5 text-sm font-semibold text-danger" role="alert">
                {error}
              </p>
              <p className="mt-4 text-muted leading-relaxed">
                Si ya hiciste el pedido y querés saber cómo va, escribinos con tu nombre y el número de pedido.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openWhatsApp(`¡Hola! Quiero consultar por mi pedido ${orderNumber}.`, true)}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden /> Consultar por WhatsApp
                </button>
                <Link href="/catalogo" className={styles.secondaryBtn}>Volver al catálogo</Link>
              </div>
            </>
          ) : (
            <p className="mt-4 text-muted" role="status">Abriendo tu pedido…</p>
          )}
        </section>
      </main>
    </StorefrontShell>
  )
}
