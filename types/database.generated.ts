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
      incomes: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          description: string | null
          id: string
          notes: string | null
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
          type?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
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
      create_sale_with_items: { Args: { p_payload: Json }; Returns: Json }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
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
