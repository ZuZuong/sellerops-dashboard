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
          user_id?: string
        }
        Relationships: [
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
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
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
          created_at: string
          description: string | null
          hero_image_path: string | null
          id: string
          image_paths: string[]
          is_active: boolean
          is_low_stock: boolean | null
          low_stock_threshold: number
          name: string
          price: number
          sku: string
          stock: number
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          hero_image_path?: string | null
          id?: string
          image_paths?: string[]
          is_active?: boolean
          is_low_stock?: boolean | null
          low_stock_threshold?: number
          name: string
          price: number
          sku?: string
          stock?: number
          user_id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          hero_image_path?: string | null
          id?: string
          image_paths?: string[]
          is_active?: boolean
          is_low_stock?: boolean | null
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string
          stock?: number
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
      deliver_order: { Args: { p_order_id: string }; Returns: undefined }
      get_dashboard_kpis: {
        Args: { p_days: number; p_tz?: string }
        Returns: {
          low_stock_count: number
          order_count: number
          pending_count: number
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
          stock_value: number
          total_units: number
        }[]
      }
      get_revenue_by_category: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          category: string
          quantity: number
          revenue: number
        }[]
      }
      get_revenue_by_day: {
        Args: { p_from: string; p_to: string; p_tz?: string }
        Returns: {
          day: string
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
          items_sold: number
          order_count: number
          prev_cancelled_count: number
          prev_items_sold: number
          prev_order_count: number
          prev_revenue: number
          revenue: number
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
          name: string
          product_id: string
          quantity_sold: number
          revenue: number
          sku: string
        }[]
      }
      lock_own_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      next_order_code: { Args: { p_user_id: string }; Returns: string }
      paths_owned_by: {
        Args: { p_owner: string; p_paths: string[] }
        Returns: boolean
      }
      report_bounds: {
        Args: { p_from: string; p_tz: string; p_to: string }
        Returns: {
          prev_start: string
          range_end: string
          range_start: string
        }[]
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
