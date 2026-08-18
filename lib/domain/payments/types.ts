export type PaymentMethodCode = 'mercado_pago' | 'bank_transfer'
export type PaymentProviderCode = 'mercado_pago' | 'manual'
export type PaymentStatus =
  | 'pending'
  | 'requires_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'partially_refunded'
  | 'refunded'

export type PricingVersionStatus = 'draft' | 'active' | 'superseded'

export type PublicPricingContext = {
  catalog_dual_price_visible: boolean
  mercado_pago_enabled?: boolean
  version_id: string | null
  effective_fee_rate: number | null
  rounding_increment: number | null
}

export type PricingVersion = {
  id: string
  version_number: number
  status: PricingVersionStatus
  effective_fee_rate: number
  rounding_increment: number
  listed_fee_rate: number | null
  iva_rate: number | null
  mp_reservation_minutes: number
  transfer_reservation_hours: number
  payments_enabled: boolean
  mercado_pago_enabled: boolean
  bank_transfer_enabled: boolean
  catalog_dual_price_visible: boolean
  bank_cbu: string | null
  bank_alias: string | null
  bank_name: string | null
  bank_account_holder: string | null
  bank_cuit: string | null
  bank_instructions: string | null
  receipt_required: boolean
  notes: string | null
  activated_by: string | null
  activated_at: string | null
  created_at: string
}

export type PricingPreviewRow = {
  kind: 'product' | 'combo'
  id: number
  name: string
  sale_price: number
  discount_percentage: number
  transfer_price: number
  public_price: number
  saving: number
}

export type PricingPreview = {
  version: PricingVersion
  affected_products: number
  affected_combos: number
  samples: PricingPreviewRow[]
}

export type PublicPaymentView = {
  order_number: string
  order_status: string
  payment_status: string | null
  method: string | null
  amount_due: number | null
  base_amount: number | null
  quoted_base_amount: number | null
  quoted_public_amount: number | null
  transfer_available: boolean
  mp_available: boolean
  checkout_url: string | null
  currency: string
  expires_at: string | null
  has_receipt: boolean
  can_retry: boolean
  bank: {
    cbu: string | null
    alias: string | null
    bank_name: string | null
    account_holder: string | null
    cuit: string | null
    instructions: string | null
  } | null
}
