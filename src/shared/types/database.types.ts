export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      inventory_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          reason: string
          receipt_id: string | null
          unit_cost: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          reason: string
          receipt_id?: string | null
          unit_cost?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          reason?: string
          receipt_id?: string | null
          unit_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_code_counters: {
        Row: {
          last_value: number
          user_id: string
        }
        Insert: {
          last_value?: number
          user_id: string
        }
        Update: {
          last_value?: number
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
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
      order_status_events: {
        Row: {
          created_at: string
          id: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          user_id?: string
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
          code: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          user_id?: string
        }
        Update: {
          code?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      product_imports: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          imported_count: number
          published: boolean
          row_count: number
          sheet_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          imported_count?: number
          published: boolean
          row_count: number
          sheet_name?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          imported_count?: number
          published?: boolean
          row_count?: number
          sheet_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_sku_counters: {
        Row: {
          last_value: number
          user_id: string
        }
        Insert: {
          last_value?: number
          user_id: string
        }
        Update: {
          last_value?: number
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          cost_price: number
          created_at: string
          description: string | null
          hero_image_path: string | null
          id: string
          image_paths: string[]
          import_id: string | null
          is_active: boolean
          is_low_stock: boolean | null
          low_stock_threshold: number
          name: string
          price: number
          sku: string
          stock: number
          unit: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          hero_image_path?: string | null
          id?: string
          image_paths?: string[]
          import_id?: string | null
          is_active?: boolean
          is_low_stock?: boolean | null
          low_stock_threshold?: number
          name: string
          price: number
          sku?: string
          stock?: number
          unit?: string
          user_id?: string
        }
        Update: {
          category?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          hero_image_path?: string | null
          id?: string
          image_paths?: string[]
          import_id?: string | null
          is_active?: boolean
          is_low_stock?: boolean | null
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string
          stock?: number
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "product_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_counters: {
        Row: {
          last_value: number
          user_id: string
        }
        Insert: {
          last_value?: number
          user_id: string
        }
        Update: {
          last_value?: number
          user_id?: string
        }
        Relationships: []
      }
      purchase_receipt_items: {
        Row: {
          condition_note: string | null
          defective_qty: number
          id: string
          ordered_qty: number
          position: number
          product_id: string
          receipt_id: string
          received_qty: number
          unit_cost: number
        }
        Insert: {
          condition_note?: string | null
          defective_qty?: number
          id?: string
          ordered_qty: number
          position?: number
          product_id: string
          receipt_id: string
          received_qty: number
          unit_cost: number
        }
        Update: {
          condition_note?: string | null
          defective_qty?: number
          id?: string
          ordered_qty?: number
          position?: number
          product_id?: string
          receipt_id?: string
          received_qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          code: string
          created_at: string
          delivered_by: string | null
          id: string
          invoice_number: string | null
          note: string | null
          posted_at: string | null
          received_date: string
          status: Database["public"]["Enums"]["receipt_status"]
          supplier_name: string
          supplier_phone: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          delivered_by?: string | null
          id?: string
          invoice_number?: string | null
          note?: string | null
          posted_at?: string | null
          received_date: string
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_name: string
          supplier_phone?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          code?: string
          created_at?: string
          delivered_by?: string | null
          id?: string
          invoice_number?: string | null
          note?: string | null
          posted_at?: string | null
          received_date?: string
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_name?: string
          supplier_phone?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: { p_delta: number; p_note?: string; p_product_id: string }
        Returns: number
      }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      confirm_order: { Args: { p_order_id: string }; Returns: undefined }
      create_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
        }
        Returns: string
      }
      dashboard_range_start: {
        Args: { p_days: number; p_tz: string }
        Returns: string
      }
      delete_product: { Args: { p_product_id: string }; Returns: undefined }
      delete_purchase_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      deliver_order: { Args: { p_order_id: string }; Returns: undefined }
      get_dashboard_kpis: {
        Args: { p_days: number; p_tz?: string }
        Returns: {
          gross_profit: number
          low_stock_count: number
          order_count: number
          pending_count: number
          prev_gross_profit: number
          prev_order_count: number
          prev_revenue: number
          revenue: number
        }[]
      }
      get_inventory_summary: {
        Args: never
        Returns: {
          low_stock_count: number
          out_of_stock_count: number
          product_count: number
          retail_value: number
          stock_value: number
          total_units: number
        }[]
      }
      get_product_insight: {
        Args: { p_product_id: string }
        Returns: {
          cogs: number
          gross_profit: number
          last_receipt_cost: number
          last_receipt_date: string
          qty_defective: number
          qty_received: number
          qty_sold: number
          receipt_count: number
          revenue: number
        }[]
      }
      get_revenue_by_category: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          category: string
          gross_profit: number
          quantity: number
          revenue: number
        }[]
      }
      get_revenue_by_day: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          cogs: number
          day: string
          gross_profit: number
          order_count: number
          revenue: number
        }[]
      }
      get_revenue_series: {
        Args: { p_days: number; p_tz?: string }
        Returns: {
          day: string
          order_count: number
          revenue: number
        }[]
      }
      get_sales_summary: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          cancelled_count: number
          cogs: number
          items_sold: number
          order_count: number
          prev_cancelled_count: number
          prev_cogs: number
          prev_items_sold: number
          prev_order_count: number
          prev_revenue: number
          purchase_qty: number
          purchase_value: number
          revenue: number
        }[]
      }
      get_stock_ledger: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          closing_qty: number
          closing_value: number
          in_qty: number
          in_value: number
          name: string
          opening_qty: number
          opening_value: number
          out_qty: number
          out_value: number
          product_id: string
          sku: string
          unit: string
        }[]
      }
      get_top_products: {
        Args: { p_days: number; p_limit?: number; p_tz?: string }
        Returns: {
          name: string
          product_id: string
          quantity_sold: number
          revenue: number
          sku: string
        }[]
      }
      get_top_products_by_range: {
        Args: { p_from: string; p_limit?: number; p_to: string; p_tz?: string }
        Returns: {
          gross_profit: number
          name: string
          product_id: string
          quantity_sold: number
          revenue: number
          sku: string
        }[]
      }
      import_products: {
        Args: { p_file: Json; p_products: Json; p_publish: boolean }
        Returns: string
      }
      lock_own_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      next_order_code: { Args: { p_user_id: string }; Returns: string }
      next_receipt_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      order_cogs: {
        Args: { p_order_id: string }
        Returns: number
      }
      paths_owned_by: {
        Args: { p_owner: string; p_paths: string[] }
        Returns: boolean
      }
      post_purchase_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      report_bounds: {
        Args: { p_from: string; p_to: string; p_tz: string }
        Returns: {
          prev_start: string
          range_end: string
          range_start: string
        }[]
      }
      save_purchase_receipt: {
        Args: { p_header: Json; p_items: Json; p_receipt_id: string }
        Returns: string
      }
      ship_order: { Args: { p_order_id: string }; Returns: undefined }
      sku_name_part: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      order_status:
        | "pending"
        | "confirmed"
        | "shipping"
        | "delivered"
        | "cancelled"
      receipt_status: "draft" | "posted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      order_status: [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
