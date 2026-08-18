export type CustomerCrmTag = {
  id: number
  name: string
  color: string
  customer_count?: number
}

export type CustomerCrmNote = {
  id: number
  body: string
  created_at: string
}

export type CustomerConsent = {
  id?: number
  granted: boolean
  source: string | null
  evidence_note: string | null
  created_at: string | null
}

export type CustomerCrmActivity = {
  id: string
  type: 'sale' | 'return' | 'order'
  event_at: string
  sale_id?: number
  order_id?: string
  order_number?: string
  amount: number
  status?: string | null
  payment_method?: string | null
  credit_note_number?: number
  reason?: string
}

export type CustomerCatalogOrderSummary = {
  order_count: number
  order_total: number
  last_order_at: string | null
  pending_count: number
  open_count: number
  completed_count: number
  cancelled_count: number
  recent: Array<{
    id: string
    order_number: string
    status: string
    total: number
    created_at: string
  }>
}

export type CustomerCrmProfile = {
  metrics: {
    sale_count: number
    gross_spent: number
    refund_total: number
    net_spent: number
    average_ticket: number
    first_purchase_at: string | null
    last_purchase_at: string | null
  }
  catalog_orders: CustomerCatalogOrderSummary
  tags: CustomerCrmTag[]
  notes: CustomerCrmNote[]
  consent: CustomerConsent
  consent_history: CustomerConsent[]
  activity: CustomerCrmActivity[]
}
