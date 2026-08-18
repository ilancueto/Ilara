export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      combo_items: {
        Row: {
          combo_id: number
          id: number
          product_id: number
          quantity: number
        }
        Insert: {
          combo_id: number
          id?: number
          product_id: number
          quantity: number
        }
        Update: {
          combo_id?: number
          id?: number
          product_id?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          name: string
          sale_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sale_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sale_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string | null
          discount_percentage: number
          id: number
          is_active: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          discount_percentage: number
          id?: number
          is_active?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          discount_percentage?: number
          id?: number
          is_active?: boolean | null
        }
        Relationships: []
      }
      customer_consent_events: {
        Row: {
          channel: string
          created_at: string
          customer_id: number
          evidence_note: string | null
          granted: boolean
          id: number
          recorded_by: string
          source: string
        }
        Insert: {
          channel?: string
          created_at?: string
          customer_id: number
          evidence_note?: string | null
          granted: boolean
          id?: number
          recorded_by: string
          source: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: number
          evidence_note?: string | null
          granted?: boolean
          id?: number
          recorded_by?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          body: string
          created_at: string
          created_by: string
          customer_id: number
          id: number
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          body: string
          created_at?: string
          created_by: string
          customer_id: number
          id?: number
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          body?: string
          created_at?: string
          created_by?: string
          customer_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          customer_id: number
          tag_id: number
        }
        Insert: {
          assigned_by: string
          created_at?: string
          customer_id: number
          tag_id: number
        }
        Update: {
          assigned_by?: string
          created_at?: string
          customer_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: number
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: number
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: number
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          first_name: string
          id: number
          last_name: string
          phone: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: number
          last_name: string
          phone?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: number
          last_name?: string
          phone?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string
          receipt_url: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description: string
          id?: string
          notes?: string | null
          payment_method: string
          receipt_url?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_url?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          counterparty: string | null
          created_at: string
          created_by: string | null
          customer_id: number | null
          description: string
          due_date: string | null
          id: string
          kind: string
          original_amount: number
          sale_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: number | null
          description: string
          due_date?: string | null
          id?: string
          kind: string
          original_amount: number
          sale_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: number | null
          description?: string
          due_date?: string | null
          id?: string
          kind?: string
          original_amount?: number
          sale_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string
          direction: string
          expense_id: string | null
          id: string
          idempotency_key: string
          note: string | null
          occurred_at: string
          payment_method: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by: string
          direction: string
          expense_id?: string | null
          id?: string
          idempotency_key: string
          note?: string | null
          occurred_at?: string
          payment_method: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string
          direction?: string
          expense_id?: string | null
          id?: string
          idempotency_key?: string
          note?: string | null
          occurred_at?: string
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          description: string | null
          id: string
          notes: string | null
          payment_method: string
          type: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          type: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          type?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_access_capabilities: {
        Row: {
          capability_hash: string
          created_at: string
          expires_at: string
          last_used_at: string | null
          order_id: string
          revoked_at: string | null
        }
        Insert: {
          capability_hash: string
          created_at?: string
          expires_at: string
          last_used_at?: string | null
          order_id: string
          revoked_at?: string | null
        }
        Update: {
          capability_hash?: string
          created_at?: string
          expires_at?: string
          last_used_at?: string | null
          order_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_access_capabilities_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          combo_components_snapshot: Json
          combo_id: number | null
          discount_percentage: number
          id: number
          line_subtotal: number
          line_type: string
          name_snapshot: string
          order_id: string
          product_id: number | null
          product_id_snapshot: number | null
          quantity: number
          sort_order: number
          unit_price: number
          variant_snapshot: string | null
        }
        Insert: {
          combo_components_snapshot?: Json
          combo_id?: number | null
          discount_percentage?: number
          id?: number
          line_subtotal: number
          line_type: string
          name_snapshot: string
          order_id: string
          product_id?: number | null
          product_id_snapshot?: number | null
          quantity: number
          sort_order?: number
          unit_price: number
          variant_snapshot?: string | null
        }
        Update: {
          combo_components_snapshot?: Json
          combo_id?: number | null
          discount_percentage?: number
          id?: number
          line_subtotal?: number
          line_type?: string
          name_snapshot?: string
          order_id?: string
          product_id?: number | null
          product_id_snapshot?: number | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          variant_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          actual_fee: number | null
          amount_due: number
          approved_at: string | null
          bank_account_holder: string | null
          bank_alias: string | null
          bank_cbu: string | null
          bank_cuit: string | null
          bank_instructions: string | null
          bank_name: string | null
          base_amount: number
          cancelled_at: string | null
          collector_id: string | null
          created_at: string
          currency: string
          estimated_fee: number | null
          expected_available_at: string | null
          expires_at: string
          external_reference: string
          id: string
          idempotency_key: string
          method: string
          net_received: number | null
          order_id: string
          price_uplift: number | null
          pricing_version_id: string
          provider: string
          provider_checkout_url: string | null
          provider_payment_id: string | null
          provider_preference_id: string | null
          public_amount: number
          reconciled_at: string | null
          refunded_amount: number
          refunded_at: string | null
          reject_reason: string | null
          rejected_at: string | null
          status: string
          transfer_saving: number
          updated_at: string
        }
        Insert: {
          actual_fee?: number | null
          amount_due: number
          approved_at?: string | null
          bank_account_holder?: string | null
          bank_alias?: string | null
          bank_cbu?: string | null
          bank_cuit?: string | null
          bank_instructions?: string | null
          bank_name?: string | null
          base_amount: number
          cancelled_at?: string | null
          collector_id?: string | null
          created_at?: string
          currency?: string
          estimated_fee?: number | null
          expected_available_at?: string | null
          expires_at: string
          external_reference: string
          id?: string
          idempotency_key: string
          method: string
          net_received?: number | null
          order_id: string
          price_uplift?: number | null
          pricing_version_id: string
          provider: string
          provider_checkout_url?: string | null
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          public_amount: number
          reconciled_at?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          status: string
          transfer_saving: number
          updated_at?: string
        }
        Update: {
          actual_fee?: number | null
          amount_due?: number
          approved_at?: string | null
          bank_account_holder?: string | null
          bank_alias?: string | null
          bank_cbu?: string | null
          bank_cuit?: string | null
          bank_instructions?: string | null
          bank_name?: string | null
          base_amount?: number
          cancelled_at?: string | null
          collector_id?: string | null
          created_at?: string
          currency?: string
          estimated_fee?: number | null
          expected_available_at?: string | null
          expires_at?: string
          external_reference?: string
          id?: string
          idempotency_key?: string
          method?: string
          net_received?: number | null
          order_id?: string
          price_uplift?: number | null
          pricing_version_id?: string
          provider?: string
          provider_checkout_url?: string | null
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          public_amount?: number
          reconciled_at?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          status?: string
          transfer_saving?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "payment_pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          id: number
          order_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: number
          order_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: number
          order_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          coupon_code: string | null
          coupon_discount_percentage: number | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          discount_total: number
          id: string
          idempotency_key: string
          notes: string | null
          order_number: string
          pricing_version_id: string | null
          public_total: number | null
          request_fingerprint: string
          shipping_amount: number
          shipping_carrier: string | null
          shipping_carrier_description: string | null
          shipping_currency: string | null
          shipping_delivery_estimate: string | null
          shipping_destination_city: string | null
          shipping_destination_formatted_address: string | null
          shipping_destination_lat: number | null
          shipping_destination_locality_id: string | null
          shipping_destination_lon: number | null
          shipping_destination_number: string | null
          shipping_destination_postal_code: string | null
          shipping_destination_province_id: string | null
          shipping_destination_state: string | null
          shipping_destination_street: string | null
          shipping_provider: string | null
          shipping_quote_id: string | null
          shipping_service: string | null
          shipping_service_description: string | null
          status: string
          stock_reserved: boolean
          subtotal: number
          total: number
          transfer_saving: number | null
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          completed_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          coupon_discount_percentage?: number | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          discount_total?: number
          id?: string
          idempotency_key: string
          notes?: string | null
          order_number: string
          pricing_version_id?: string | null
          public_total?: number | null
          request_fingerprint: string
          shipping_amount?: number
          shipping_carrier?: string | null
          shipping_carrier_description?: string | null
          shipping_currency?: string | null
          shipping_delivery_estimate?: string | null
          shipping_destination_city?: string | null
          shipping_destination_formatted_address?: string | null
          shipping_destination_lat?: number | null
          shipping_destination_locality_id?: string | null
          shipping_destination_lon?: number | null
          shipping_destination_number?: string | null
          shipping_destination_postal_code?: string | null
          shipping_destination_province_id?: string | null
          shipping_destination_state?: string | null
          shipping_destination_street?: string | null
          shipping_provider?: string | null
          shipping_quote_id?: string | null
          shipping_service?: string | null
          shipping_service_description?: string | null
          status?: string
          stock_reserved?: boolean
          subtotal: number
          total: number
          transfer_saving?: number | null
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          completed_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          coupon_discount_percentage?: number | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          discount_total?: number
          id?: string
          idempotency_key?: string
          notes?: string | null
          order_number?: string
          pricing_version_id?: string | null
          public_total?: number | null
          request_fingerprint?: string
          shipping_amount?: number
          shipping_carrier?: string | null
          shipping_carrier_description?: string | null
          shipping_currency?: string | null
          shipping_delivery_estimate?: string | null
          shipping_destination_city?: string | null
          shipping_destination_formatted_address?: string | null
          shipping_destination_lat?: number | null
          shipping_destination_locality_id?: string | null
          shipping_destination_lon?: number | null
          shipping_destination_number?: string | null
          shipping_destination_postal_code?: string | null
          shipping_destination_province_id?: string | null
          shipping_destination_state?: string | null
          shipping_destination_street?: string | null
          shipping_provider?: string | null
          shipping_quote_id?: string | null
          shipping_service?: string | null
          shipping_service_description?: string | null
          status?: string
          stock_reserved?: boolean
          subtotal?: number
          total?: number
          transfer_saving?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "payment_pricing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_quote_fkey"
            columns: ["shipping_quote_id"]
            isOneToOne: true
            referencedRelation: "shipping_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      passkey_audit_log: {
        Row: {
          created_at: string
          credential_id: string | null
          email: string | null
          error_code: string | null
          error_message: string | null
          event_type: Database["public"]["Enums"]["passkey_audit_event"]
          id: string
          ip_address: unknown
          metadata: Json | null
          origin: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          email?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type: Database["public"]["Enums"]["passkey_audit_event"]
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          origin?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          email?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["passkey_audit_event"]
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          origin?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      passkey_challenges: {
        Row: {
          challenge: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          type: string
          user_id: string | null
          webauthn_user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type: string
          user_id?: string | null
          webauthn_user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type?: string
          user_id?: string | null
          webauthn_user_id?: string | null
        }
        Relationships: []
      }
      passkey_credentials: {
        Row: {
          aaguid: string | null
          authenticator_name: string | null
          backed_up: boolean
          counter: number
          created_at: string
          device_type: string
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
          webauthn_user_id: string
        }
        Insert: {
          aaguid?: string | null
          authenticator_name?: string | null
          backed_up?: boolean
          counter?: number
          created_at?: string
          device_type: string
          id: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
          webauthn_user_id: string
        }
        Update: {
          aaguid?: string | null
          authenticator_name?: string | null
          backed_up?: boolean
          counter?: number
          created_at?: string
          device_type?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
          webauthn_user_id?: string
        }
        Relationships: []
      }
      passkey_rate_limits: {
        Row: {
          attempt_count: number
          created_at: string
          endpoint: string
          id: string
          identifier: string
          identifier_type: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          identifier_type: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          identifier_type?: string
          window_start?: string
        }
        Relationships: []
      }
      payment_access_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          order_id: string
          payment_id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          order_id: string
          payment_id: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          order_id?: string
          payment_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_access_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_access_tokens_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "order_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          normalized_status: string | null
          payload_hash: string
          payment_id: string
          processing_result: string
          provider_event_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          normalized_status?: string | null
          payload_hash: string
          payment_id: string
          processing_result: string
          provider_event_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          normalized_status?: string | null
          payload_hash?: string
          payment_id?: string
          processing_result?: string
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "order_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_expire_runs: {
        Row: {
          actor: string
          expired_count: number
          finished_at: string
          id: number
          started_at: string
        }
        Insert: {
          actor?: string
          expired_count: number
          finished_at?: string
          id?: number
          started_at?: string
        }
        Update: {
          actor?: string
          expired_count?: number
          finished_at?: string
          id?: number
          started_at?: string
        }
        Relationships: []
      }
      payment_pricing_versions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          bank_account_holder: string | null
          bank_alias: string | null
          bank_cbu: string | null
          bank_cuit: string | null
          bank_instructions: string | null
          bank_name: string | null
          bank_transfer_enabled: boolean
          catalog_dual_price_visible: boolean
          created_at: string
          created_by: string | null
          effective_fee_rate: number
          id: string
          iva_rate: number | null
          listed_fee_rate: number | null
          mercado_pago_enabled: boolean
          mp_reservation_minutes: number
          notes: string | null
          payments_enabled: boolean
          receipt_required: boolean
          rounding_increment: number
          status: string
          superseded_at: string | null
          transfer_reservation_hours: number
          updated_at: string
          version_number: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          bank_account_holder?: string | null
          bank_alias?: string | null
          bank_cbu?: string | null
          bank_cuit?: string | null
          bank_instructions?: string | null
          bank_name?: string | null
          bank_transfer_enabled?: boolean
          catalog_dual_price_visible?: boolean
          created_at?: string
          created_by?: string | null
          effective_fee_rate: number
          id?: string
          iva_rate?: number | null
          listed_fee_rate?: number | null
          mercado_pago_enabled?: boolean
          mp_reservation_minutes?: number
          notes?: string | null
          payments_enabled?: boolean
          receipt_required?: boolean
          rounding_increment: number
          status: string
          superseded_at?: string | null
          transfer_reservation_hours?: number
          updated_at?: string
          version_number: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          bank_account_holder?: string | null
          bank_alias?: string | null
          bank_cbu?: string | null
          bank_cuit?: string | null
          bank_instructions?: string | null
          bank_name?: string | null
          bank_transfer_enabled?: boolean
          catalog_dual_price_visible?: boolean
          created_at?: string
          created_by?: string | null
          effective_fee_rate?: number
          id?: string
          iva_rate?: number | null
          listed_fee_rate?: number | null
          mercado_pago_enabled?: boolean
          mp_reservation_minutes?: number
          notes?: string | null
          payments_enabled?: boolean
          receipt_required?: boolean
          rounding_increment?: number
          status?: string
          superseded_at?: string | null
          transfer_reservation_hours?: number
          updated_at?: string
          version_number?: number
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          byte_size: number
          id: string
          mime_type: string
          payment_id: string
          sha256: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          byte_size: number
          id?: string
          mime_type: string
          payment_id: string
          sha256: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          byte_size?: number
          id?: string
          mime_type?: string
          payment_id?: string
          sha256?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "order_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          catalog_badge: string | null
          category_id: number | null
          color: string | null
          created_at: string
          created_by: string | null
          discount_percentage: number | null
          id: number
          image_url: string | null
          image_urls: string[] | null
          min_stock: number
          name: string
          notes: string | null
          purchase_price: number | null
          sale_price: number
          stock: number
          updated_at: string
          updated_by: string | null
          visible_in_catalog: boolean | null
        }
        Insert: {
          brand?: string | null
          catalog_badge?: string | null
          category_id?: number | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          discount_percentage?: number | null
          id?: number
          image_url?: string | null
          image_urls?: string[] | null
          min_stock?: number
          name: string
          notes?: string | null
          purchase_price?: number | null
          sale_price?: number
          stock?: number
          updated_at?: string
          updated_by?: string | null
          visible_in_catalog?: boolean | null
        }
        Update: {
          brand?: string | null
          catalog_badge?: string | null
          category_id?: number | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          discount_percentage?: number | null
          id?: number
          image_url?: string | null
          image_urls?: string[] | null
          min_stock?: number
          name?: string
          notes?: string | null
          purchase_price?: number | null
          sale_price?: number
          stock?: number
          updated_at?: string
          updated_by?: string | null
          visible_in_catalog?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item_components: {
        Row: {
          cost_source: string
          created_at: string
          id: number
          product_id: number | null
          product_name: string
          quantity_per_unit: number
          sale_item_id: number
          snapshot_source: string
          unit_cost: number | null
        }
        Insert: {
          cost_source: string
          created_at?: string
          id?: number
          product_id?: number | null
          product_name: string
          quantity_per_unit: number
          sale_item_id: number
          snapshot_source: string
          unit_cost?: number | null
        }
        Update: {
          cost_source?: string
          created_at?: string
          id?: number
          product_id?: number | null
          product_name?: string
          quantity_per_unit?: number
          sale_item_id?: number
          snapshot_source?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_components_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          combo_id: number | null
          discount_percentage: number | null
          id: number
          product_id: number | null
          product_name: string
          quantity: number
          sale_id: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          combo_id?: number | null
          discount_percentage?: number | null
          id?: number
          product_id?: number | null
          product_name?: string
          quantity?: number
          sale_id: number
          subtotal?: number
          unit_price?: number
        }
        Update: {
          combo_id?: number | null
          discount_percentage?: number | null
          id?: number
          product_id?: number | null
          product_name?: string
          quantity?: number
          sale_id?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_events: {
        Row: {
          actor_user_id: string
          created_at: string
          event_type: string
          id: number
          meta: Json
          return_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: number
          meta?: Json
          return_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: number
          meta?: Json
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_events_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          created_at: string
          id: number
          product_id: number | null
          product_name: string
          quantity: number
          refund_amount: number
          return_id: string
          sale_item_id: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: number
          product_id?: number | null
          product_name: string
          quantity: number
          refund_amount: number
          return_id: string
          sale_item_id: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: number
          product_id?: number | null
          product_name?: string
          quantity?: number
          refund_amount?: number
          return_id?: string
          sale_item_id?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          created_at: string
          created_by: string
          credit_note_number: number
          id: string
          idempotency_key: string
          reason: string
          refund_method: string
          refund_total: number
          restock: boolean
          sale_id: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          credit_note_number?: number
          id?: string
          idempotency_key: string
          reason: string
          refund_method: string
          refund_total: number
          restock?: boolean
          sale_id: number
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          credit_note_number?: number
          id?: string
          idempotency_key?: string
          reason?: string
          refund_method?: string
          refund_total?: number
          restock?: boolean
          sale_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: number | null
          customer_name: string | null
          id: number
          notes: string | null
          payment_breakdown: Json | null
          payment_method: string | null
          receipt_url: string | null
          sale_date: string
          status: string
          total: number
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: number | null
          customer_name?: string | null
          id?: number
          notes?: string | null
          payment_breakdown?: Json | null
          payment_method?: string | null
          receipt_url?: string | null
          sale_date?: string
          status?: string
          total?: number
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: number | null
          customer_name?: string | null
          id?: number
          notes?: string | null
          payment_breakdown?: Json | null
          payment_method?: string | null
          receipt_url?: string | null
          sale_date?: string
          status?: string
          total?: number
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_geocode_cache: {
        Row: {
          created_at: string
          postal_code: string
          query_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          postal_code: string
          query_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          postal_code?: string
          query_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_geocode_requests: {
        Row: {
          id: number
          requested_at: string
        }
        Insert: {
          id?: never
          requested_at?: string
        }
        Update: {
          id?: never
          requested_at?: string
        }
        Relationships: []
      }
      shipping_quote_requests: {
        Row: {
          created_at: string
          destination_postal_code: string | null
          id: number
          request_ip_hash: string
        }
        Insert: {
          created_at?: string
          destination_postal_code?: string | null
          id?: never
          request_ip_hash: string
        }
        Update: {
          created_at?: string
          destination_postal_code?: string | null
          id?: never
          request_ip_hash?: string
        }
        Relationships: []
      }
      shipping_quotes: {
        Row: {
          amount: number
          carrier: string
          carrier_description: string
          consumed_at: string | null
          created_at: string
          currency: string
          delivery_estimate: string | null
          destination_city: string
          destination_formatted_address: string | null
          destination_lat: number | null
          destination_locality_id: string | null
          destination_lon: number | null
          destination_number: string | null
          destination_postal_code: string
          destination_province_id: string | null
          destination_state: string
          destination_street: string | null
          expires_at: string
          id: string
          order_id: string | null
          provider: string
          quote_group_id: string
          request_ip_hash: string
          service: string
          service_description: string
        }
        Insert: {
          amount: number
          carrier: string
          carrier_description: string
          consumed_at?: string | null
          created_at?: string
          currency: string
          delivery_estimate?: string | null
          destination_city: string
          destination_formatted_address?: string | null
          destination_lat?: number | null
          destination_locality_id?: string | null
          destination_lon?: number | null
          destination_number?: string | null
          destination_postal_code: string
          destination_province_id?: string | null
          destination_state: string
          destination_street?: string | null
          expires_at: string
          id?: string
          order_id?: string | null
          provider?: string
          quote_group_id: string
          request_ip_hash: string
          service: string
          service_description: string
        }
        Update: {
          amount?: number
          carrier?: string
          carrier_description?: string
          consumed_at?: string | null
          created_at?: string
          currency?: string
          delivery_estimate?: string | null
          destination_city?: string
          destination_formatted_address?: string | null
          destination_lat?: number | null
          destination_locality_id?: string | null
          destination_lon?: number | null
          destination_number?: string | null
          destination_postal_code?: string
          destination_province_id?: string | null
          destination_state?: string
          destination_street?: string | null
          expires_at?: string
          id?: string
          order_id?: string | null
          provider?: string
          quote_group_id?: string
          request_ip_hash?: string
          service?: string
          service_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_quotes_order_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alert_events: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          alert_id: string
          created_at: string
          from_status: string | null
          id: number
          meta: Json
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_kind?: string
          actor_user_id?: string | null
          alert_id: string
          created_at?: string
          from_status?: string | null
          id?: number
          meta?: Json
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          alert_id?: string
          created_at?: string
          from_status?: string | null
          id?: number
          meta?: Json
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "stock_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          assigned_to: string | null
          deficit: number
          dismissed_at: string | null
          id: string
          min_stock_at_open: number
          min_stock_current: number
          note: string | null
          opened_at: string
          product_id: number
          resolution_kind: string | null
          resolved_at: string | null
          status: string
          stock_at_open: number
          stock_current: number
          suggested_qty: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          deficit?: number
          dismissed_at?: string | null
          id?: string
          min_stock_at_open: number
          min_stock_current: number
          note?: string | null
          opened_at?: string
          product_id: number
          resolution_kind?: string | null
          resolved_at?: string | null
          status?: string
          stock_at_open: number
          stock_current: number
          suggested_qty: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          deficit?: number
          dismissed_at?: string | null
          id?: string
          min_stock_at_open?: number
          min_stock_current?: number
          note?: string | null
          opened_at?: string
          product_id?: number
          resolution_kind?: string | null
          resolved_at?: string | null
          status?: string
          stock_at_open?: number
          stock_current?: number
          suggested_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          id: number
          notes: string | null
          product_id: number
          quantity: number
          reference_id: number | null
          reference_type: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          notes?: string | null
          product_id: number
          quantity: number
          reference_id?: number | null
          reference_type?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          notes?: string | null
          product_id?: number
          quantity?: number
          reference_id?: number | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_shipping_geocode_slot: { Args: never; Returns: undefined }
      admin_order_payments: { Args: { p_order_id: string }; Returns: Json }
      admin_payment_ops_board: { Args: never; Returns: Json }
      admin_payment_receipt_path: {
        Args: { p_payment_id: string }
        Returns: string
      }
      admin_refund_catalog_payment: {
        Args: { p_amount: number; p_payment_id: string; p_reason: string }
        Returns: Json
      }
      admin_review_transfer_payment: {
        Args: { p_action: string; p_payment_id: string; p_reason?: string }
        Returns: Json
      }
      apply_mercado_pago_payment: { Args: { p_payload: Json }; Returns: Json }
      attach_mp_preference: { Args: { p_payload: Json }; Returns: Json }
      bootstrap_first_admin: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      can_manage_finance: { Args: never; Returns: boolean }
      can_manage_inventory: { Args: never; Returns: boolean }
      can_use_pos: { Args: never; Returns: boolean }
      catalog_sales_by_product: {
        Args: never
        Returns: {
          product_id: number
          units_sold: number
        }[]
      }
      check_passkey_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_identifier_type: string
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_passkey_challenges: { Args: never; Returns: number }
      complete_transfer_receipt: {
        Args: {
          p_access_capability: string
          p_byte_size: number
          p_mime_type: string
          p_sha256: string
          p_storage_path: string
        }
        Returns: Json
      }
      confirm_catalog_order_after_payment: {
        Args: { p_order_id: string }
        Returns: Json
      }
      create_catalog_order: { Args: { p_payload: Json }; Returns: Json }
      create_catalog_order_core_stage61: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_catalog_order_core_stage72: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_sale_return: { Args: { p_payload: Json }; Returns: Json }
      create_sale_with_items: { Args: { p_payload: Json }; Returns: Json }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      customer_crm_add_note: {
        Args: { p_body: string; p_customer_id: number }
        Returns: Json
      }
      customer_crm_archive_note: { Args: { p_note_id: number }; Returns: Json }
      customer_crm_profile: { Args: { p_customer_id: number }; Returns: Json }
      customer_crm_record_consent: {
        Args: {
          p_customer_id: number
          p_evidence_note?: string
          p_granted: boolean
          p_source: string
        }
        Returns: Json
      }
      customer_crm_set_tags: {
        Args: { p_customer_id: number; p_tag_ids: number[] }
        Returns: Json
      }
      customer_crm_tags: { Args: never; Returns: Json }
      customer_crm_upsert_tag: {
        Args: { p_color?: string; p_id: number; p_name: string }
        Returns: Json
      }
      dashboard_finance_kpis: { Args: { p_since?: string }; Returns: Json }
      dashboard_sales_daily: {
        Args: { p_days?: number }
        Returns: {
          sale_count: number
          sale_day: string
          total: number
        }[]
      }
      dashboard_sales_monthly: {
        Args: { p_months?: number }
        Returns: {
          month_start: string
          sale_count: number
          total: number
        }[]
      }
      dashboard_sales_monthly_total_span: {
        Args: never
        Returns: {
          month_start: string
          sale_count: number
          total: number
        }[]
      }
      delete_sale_and_restore_stock: {
        Args: { p_sale_id: number }
        Returns: Json
      }
      expire_catalog_payments: { Args: never; Returns: Json }
      finance_account_net_amount: {
        Args: {
          p_account: Database["public"]["Tables"]["financial_accounts"]["Row"]
        }
        Returns: number
      }
      finance_cancel_payable: {
        Args: { p_account_id: string; p_reason: string }
        Returns: Json
      }
      finance_create_payable: {
        Args: {
          p_amount: number
          p_counterparty: string
          p_description: string
          p_due_date?: string
        }
        Returns: Json
      }
      finance_record_settlement: {
        Args: {
          p_account_id: string
          p_amount: number
          p_idempotency_key?: string
          p_note?: string
          p_occurred_at?: string
          p_payment_method: string
        }
        Returns: Json
      }
      finance_stage66_snapshot: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      finance_stage8_payments_slice: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      get_catalog_payment_public: {
        Args: { p_access_capability: string }
        Returns: Json
      }
      is_app_admin: { Args: never; Returns: boolean }
      log_passkey_audit_event: {
        Args: {
          p_credential_id?: string
          p_email?: string
          p_error_code?: string
          p_error_message?: string
          p_event_type: Database["public"]["Enums"]["passkey_audit_event"]
          p_ip_address?: unknown
          p_metadata?: Json
          p_origin?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      mp_preference_context: {
        Args: { p_access_capability: string }
        Returns: Json
      }
      next_catalog_order_number: { Args: never; Returns: string }
      payment_admin_activate_version: {
        Args: { p_version_id: string }
        Returns: Json
      }
      payment_admin_list_versions: { Args: never; Returns: Json }
      payment_admin_preview_pricing: {
        Args: { p_version_id?: string }
        Returns: Json
      }
      payment_admin_save_draft: { Args: { p_payload: Json }; Returns: Json }
      payment_expire_health: { Args: never; Returns: Json }
      payment_public_price: {
        Args: { p_base: number; p_fee_rate?: number; p_increment?: number }
        Returns: number
      }
      payment_public_pricing_context: { Args: never; Returns: Json }
      payment_quote_totals: {
        Args: { p_fee_rate?: number; p_increment?: number; p_payload: Json }
        Returns: Json
      }
      prepare_transfer_receipt: {
        Args: { p_access_capability: string; p_extension: string }
        Returns: Json
      }
      sales_margin_report: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      stage0_inventory_legacy_receipt_urls: {
        Args: never
        Returns: {
          bucket_path: string
          is_legacy: boolean
          owner_id: string
          row_id: string
          source_table: string
          stored_url: string
        }[]
      }
      start_catalog_order_payment: { Args: { p_payload: Json }; Returns: Json }
      stock_alert_deficit: {
        Args: { p_min_stock: number; p_stock: number }
        Returns: number
      }
      stock_alert_suggested_qty: {
        Args: { p_min_stock: number; p_stock: number }
        Returns: number
      }
      stock_alert_target_qty: { Args: { p_min_stock: number }; Returns: number }
      sync_stock_alert_for_product: {
        Args: { p_product_id: number }
        Returns: undefined
      }
      transition_catalog_order: {
        Args: { p_order_id: string; p_reason?: string; p_to_status: string }
        Returns: Json
      }
      transition_stock_alert: {
        Args: { p_alert_id: string; p_note?: string; p_to_status: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "none"
      passkey_audit_event:
        | "registration_started"
        | "registration_completed"
        | "registration_failed"
        | "authentication_started"
        | "authentication_completed"
        | "authentication_failed"
        | "passkey_removed"
        | "passkey_updated"
        | "rate_limit_exceeded"
        | "challenge_expired"
        | "counter_mismatch"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor", "none"],
      passkey_audit_event: [
        "registration_started",
        "registration_completed",
        "registration_failed",
        "authentication_started",
        "authentication_completed",
        "authentication_failed",
        "passkey_removed",
        "passkey_updated",
        "rate_limit_exceeded",
        "challenge_expired",
        "counter_mismatch",
      ],
    },
  },
} as const

