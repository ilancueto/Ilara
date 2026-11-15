'use client'

import styles from '@/components/storefront/storefront.module.css'

type Props = {
  formId: string
  pending: boolean
  name: string
  setName: (value: string) => void
  phone: string
  setPhone: (value: string) => void
  email: string
  setEmail: (value: string) => void
}

/** Datos de contacto de la clienta. */
export function CheckoutDatosFields({ formId, pending, name, setName, phone, setPhone, email, setEmail }: Props) {
  return (
      <div className={styles.box}>
        <h2>Tus datos</h2>

        <div className={styles.field}>
          <label htmlFor={`${formId}-name`}>Nombre y Apellido *</label>
          <input
            id={`${formId}-name`}
            name="customer_name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Valeria Gómez"
            required
            disabled={pending}
            data-testid="checkout-name"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-phone`}>Teléfono / WhatsApp *</label>
          <input
            id={`${formId}-phone`}
            name="customer_phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: 11 5849-2310"
            required
            disabled={pending}
            data-testid="checkout-phone"
            aria-describedby={`${formId}-phone-hint`}
          />
          <p id={`${formId}-phone-hint`} className={styles.muted}>
            Lo usamos para coordinar por WhatsApp si lo necesitás.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-email`}>Email (opcional)</label>
          <input
            id={`${formId}-email`}
            name="customer_email"
            type="email"
            autoComplete="email"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            disabled={pending}
            data-testid="checkout-email"
            aria-describedby={`${formId}-email-hint`}
          />
          <p id={`${formId}-email-hint`} className={styles.muted}>
            Si lo completás, te enviaremos confirmación y seguimiento por email.
          </p>
        </div>
      </div>
  )
}
