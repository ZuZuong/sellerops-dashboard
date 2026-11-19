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
      account_deletion_evidence: {
        Row: {
          created_at: string
          deletion_id: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          deletion_id: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
        }
        Update: {
          created_at?: string
          deletion_id?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_evidence_deletion_id_fkey"
            columns: ["deletion_id"]
            isOneToOne: false
            referencedRelation: "account_deletions"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletions: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          email: string | null
          former_user_id: string
          full_name: string | null
          id: string
          notified_at: string | null
          notify_error: string | null
          previous_locked: boolean
          previous_locked_at: string | null
          previous_locked_reason: string | null
          reason: string
          requested_at: string
          requested_by: string | null
          restore_note: string | null
          restored_at: string | null
          restored_by: string | null
          seller_id: string | null
          shop_name: string | null
          status: Database["public"]["Enums"]["account_deletion_status"]
          user_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          email?: string | null
          former_user_id: string
          full_name?: string | null
          id?: string
          notified_at?: string | null
          notify_error?: string | null
          previous_locked: boolean
          previous_locked_at?: string | null
          previous_locked_reason?: string | null
          reason: string
          requested_at?: string
          requested_by?: string | null
          restore_note?: string | null
          restored_at?: string | null
          restored_by?: string | null
          seller_id?: string | null
          shop_name?: string | null
          status?: Database["public"]["Enums"]["account_deletion_status"]
          user_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          email?: string | null
          former_user_id?: string
          full_name?: string | null
          id?: string
          notified_at?: string | null
          notify_error?: string | null
          previous_locked?: boolean
          previous_locked_at?: string | null
          previous_locked_reason?: string | null
          reason?: string
          requested_at?: string
          requested_by?: string | null
          restore_note?: string | null
          restored_at?: string | null
          restored_by?: string | null
          seller_id?: string | null
          shop_name?: string | null
          status?: Database["public"]["Enums"]["account_deletion_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_deletions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          changes: Json
          created_at: string
          id: string
          level: string
          message: string | null
          path: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          id?: string
          level: string
          message?: string | null
          path?: string | null
          read_at?: string | null
          title: string
          user_id?: string
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          level?: string
          message?: string | null
          path?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          seller_id: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          seller_id: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          seller_id?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          last_order_at: string | null
          name: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          phone: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          last_order_at?: string | null
          name: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          phone: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          last_order_at?: string | null
          name?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          phone?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
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
          seller_id: string
          unit_cost: number | null
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
          seller_id: string
          unit_cost?: number | null
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
          seller_id?: string
          unit_cost?: number | null
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
          {
            foreignKeyName: "inventory_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_code_counters: {
        Row: {
          last_value: number
          seller_id: string
        }
        Insert: {
          last_value?: number
          seller_id: string
        }
        Update: {
          last_value?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_code_counters_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
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
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          seller_id: string
          shipping_address: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }
        Insert: {
          code: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          seller_id: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
        }
        Update: {
          code?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          seller_id?: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
          published_count: number
          row_count: number
          seller_id: string
          sheet_name: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          imported_count?: number
          published: boolean
          published_count?: number
          row_count: number
          seller_id: string
          sheet_name?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          imported_count?: number
          published?: boolean
          published_count?: number
          row_count?: number
          seller_id?: string
          sheet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_imports_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sku_counters: {
        Row: {
          last_value: number
          seller_id: string
        }
        Insert: {
          last_value?: number
          seller_id: string
        }
        Update: {
          last_value?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sku_counters_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sku_free_numbers: {
        Row: {
          seller_id: string
          value: number
        }
        Insert: {
          seller_id: string
          value: number
        }
        Update: {
          seller_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sku_free_numbers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_trash: {
        Row: {
          category: string | null
          cost_price: number
          deleted_at: string
          hero_image_path: string | null
          id: string
          image_paths: string[]
          movements: Json
          name: string
          price: number
          product: Json
          purge_at: string
          seller_id: string
          sku: string
          stock: number
          unit: string
        }
        Insert: {
          category?: string | null
          cost_price: number
          deleted_at?: string
          hero_image_path?: string | null
          id: string
          image_paths?: string[]
          movements?: Json
          name: string
          price: number
          product: Json
          purge_at?: string
          seller_id: string
          sku: string
          stock: number
          unit: string
        }
        Update: {
          category?: string | null
          cost_price?: number
          deleted_at?: string
          hero_image_path?: string | null
          id?: string
          image_paths?: string[]
          movements?: Json
          name?: string
          price?: number
          product?: Json
          purge_at?: string
          seller_id?: string
          sku?: string
          stock?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_trash_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
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
          seller_id: string
          sku: string
          stock: number
          unit: string
        }
        Insert: {
          category_id?: string | null
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
          seller_id?: string
          sku?: string
          stock?: number
          unit?: string
        }
        Update: {
          category_id?: string | null
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
          seller_id?: string
          sku?: string
          stock?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_same_seller_fkey"
            columns: ["seller_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["seller_id", "id"]
          },
          {
            foreignKeyName: "products_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "product_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          full_name: string | null
          id: string
          is_locked: boolean
          locked_at: string | null
          locked_reason: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          full_name?: string | null
          id: string
          is_locked?: boolean
          locked_at?: string | null
          locked_reason?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          full_name?: string | null
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_reason?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      purchase_receipt_counters: {
        Row: {
          last_value: number
          seller_id: string
        }
        Insert: {
          last_value?: number
          seller_id: string
        }
        Update: {
          last_value?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_counters_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
          seller_id: string
          status: Database["public"]["Enums"]["receipt_status"]
          supplier_name: string
          supplier_phone: string | null
          total_amount: number
          updated_at: string
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
          seller_id: string
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_name: string
          supplier_phone?: string | null
          total_amount?: number
          updated_at?: string
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
          seller_id?: string
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_name?: string
          supplier_phone?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          kind: Database["public"]["Enums"]["seller_document_kind"]
          mime_type: string
          seller_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          kind: Database["public"]["Enums"]["seller_document_kind"]
          mime_type: string
          seller_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          kind?: Database["public"]["Enums"]["seller_document_kind"]
          mime_type?: string
          seller_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_documents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          address: string | null
          business_name: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          contact_email: string | null
          created_at: string
          current_step: number
          former_owner_email: string | null
          former_owner_id: string | null
          former_owner_name: string | null
          id: string
          license_number: string | null
          main_category: string | null
          owner_id: string | null
          owner_removed_at: string | null
          rejection_reason: string | null
          representative_name: string | null
          representative_phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_name: string | null
          slug: string | null
          status: Database["public"]["Enums"]["seller_status"]
          submitted_at: string | null
          suspended_reason: string | null
          tax_code: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          contact_email?: string | null
          created_at?: string
          current_step?: number
          former_owner_email?: string | null
          former_owner_id?: string | null
          former_owner_name?: string | null
          id?: string
          license_number?: string | null
          main_category?: string | null
          owner_id?: string | null
          owner_removed_at?: string | null
          rejection_reason?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_name?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          submitted_at?: string | null
          suspended_reason?: string | null
          tax_code?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          contact_email?: string | null
          created_at?: string
          current_step?: number
          former_owner_email?: string | null
          former_owner_id?: string | null
          former_owner_name?: string | null
          id?: string
          license_number?: string | null
          main_category?: string | null
          owner_id?: string | null
          owner_removed_at?: string | null
          rejection_reason?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_name?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          submitted_at?: string | null
          suspended_reason?: string | null
          tax_code?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
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
      admin_deletion_notice: {
        Args: { p_deletion_id: string }
        Returns: {
          email: string
          evidence_count: number
          full_name: string
          reason: string
          requested_at: string
          shop_name: string
        }[]
      }
      admin_get_seller: {
        Args: { p_seller_id: string }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          address: string
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          contact_email: string
          created_at: string
          id: string
          is_locked: boolean
          license_number: string
          locked_reason: string
          main_category: string
          owner_email: string
          owner_full_name: string
          owner_id: string
          rejection_reason: string
          representative_name: string
          representative_phone: string
          reviewed_at: string
          reviewer_email: string
          shop_name: string
          slug: string
          status: Database["public"]["Enums"]["seller_status"]
          submitted_at: string
          suspended_reason: string
          tax_code: string
          terms_accepted_at: string
          terms_version: string
        }[]
      }
      admin_list_account_deletions: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_status?: Database["public"]["Enums"]["account_deletion_status"]
        }
        Returns: {
          confirmed_at: string
          email: string
          evidence_count: number
          full_name: string
          id: string
          notified_at: string
          notify_error: string
          reason: string
          requested_at: string
          requested_by_email: string
          restore_note: string
          restored_at: string
          role: Database["public"]["Enums"]["user_role"]
          seller_id: string
          shop_name: string
          status: Database["public"]["Enums"]["account_deletion_status"]
          total_count: number
          user_id: string
        }[]
      }
      admin_list_accounts: {
        Args: {
          p_account_status?: Database["public"]["Enums"]["account_status"]
          p_locked?: boolean
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_role?: Database["public"]["Enums"]["user_role"]
          p_seller_status?: Database["public"]["Enums"]["seller_status"]
        }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          email: string
          email_confirmed: boolean
          full_name: string
          id: string
          is_locked: boolean
          last_sign_in_at: string
          locked_reason: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          seller_id: string
          seller_status: Database["public"]["Enums"]["seller_status"]
          shop_name: string
          total_count: number
        }[]
      }
      admin_list_audit_logs: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_target_ids?: string[]
          p_to?: string
        }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string
          target_label: string
          target_type: string
          total_count: number
        }[]
      }
      admin_list_sellers: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_status?: Database["public"]["Enums"]["seller_status"]
        }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          business_name: string
          created_at: string
          id: string
          is_locked: boolean
          order_count: number
          owner_email: string
          owner_id: string
          product_count: number
          revenue: number
          reviewed_at: string
          shop_name: string
          status: Database["public"]["Enums"]["seller_status"]
          submitted_at: string
          total_count: number
        }[]
      }
      admin_platform_stats: {
        Args: { p_days?: number }
        Returns: {
          approved_count: number
          draft_count: number
          locked_accounts: number
          new_accounts: number
          pending_count: number
          pending_deletion_count: number
          period_orders: number
          period_revenue: number
          rejected_count: number
          suspended_count: number
          total_accounts: number
          total_orders: number
          total_revenue: number
        }[]
      }
      admin_revenue_series: {
        Args: { p_days?: number }
        Returns: {
          day: string
          orders: number
          revenue: number
        }[]
      }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      clean_category_name: { Args: { p_name: string }; Returns: string }
      confirm_account_deletion: {
        Args: { p_deletion_id: string }
        Returns: undefined
      }
      confirm_order: { Args: { p_order_id: string }; Returns: undefined }
      create_category: { Args: { p_name: string }; Returns: string }
      create_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_payment_method?: string
          p_save_customer?: boolean
          p_shipping_address?: string
        }
        Returns: string
      }
      current_approved_seller_id: { Args: never; Returns: string }
      current_seller_id: { Args: never; Returns: string }
      current_seller_status: {
        Args: never
        Returns: Database["public"]["Enums"]["seller_status"]
      }
      dashboard_range_start: {
        Args: { p_days: number; p_tz: string }
        Returns: string
      }
      delete_category: {
        Args: { p_id: string; p_move_to_id?: string }
        Returns: Json
      }
      delete_purchase_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      deliver_order: { Args: { p_order_id: string }; Returns: undefined }
      find_existing_product_names: {
        Args: { p_names: string[] }
        Returns: string[]
      }
      get_category_overview: {
        Args: { p_seller_id?: string }
        Returns: {
          active_count: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          product_count: number
          slug: string
          sort_order: number
        }[]
      }
      get_dashboard_kpis: {
        Args: { p_days: number; p_seller_id?: string; p_tz?: string }
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
        Args: { p_seller_id?: string }
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
        Args: {
          p_from: string
          p_seller_id?: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          category: string
          gross_profit: number
          quantity: number
          revenue: number
        }[]
      }
      get_revenue_by_day: {
        Args: {
          p_from: string
          p_seller_id?: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          cogs: number
          day: string
          gross_profit: number
          order_count: number
          revenue: number
        }[]
      }
      get_revenue_report: {
        Args: {
          p_from: string
          p_seller_id?: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          code: string
          cogs: number
          created_at: string
          customer_name: string
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          quantity: number
          revenue: number
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      get_revenue_series: {
        Args: { p_days: number; p_seller_id?: string; p_tz?: string }
        Returns: {
          day: string
          order_count: number
          revenue: number
        }[]
      }
      get_sales_summary: {
        Args: {
          p_from: string
          p_seller_id?: string
          p_to: string
          p_tz?: string
        }
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
        Args: {
          p_from: string
          p_seller_id?: string
          p_to: string
          p_tz?: string
        }
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
        Args: {
          p_days: number
          p_limit?: number
          p_seller_id?: string
          p_tz?: string
        }
        Returns: {
          name: string
          product_id: string
          quantity_sold: number
          revenue: number
          sku: string
        }[]
      }
      get_top_products_by_range: {
        Args: {
          p_from: string
          p_limit?: number
          p_seller_id?: string
          p_to: string
          p_tz?: string
        }
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
      is_admin: { Args: never; Returns: boolean }
      is_seller_approved: { Args: { p_seller_id: string }; Returns: boolean }
      lock_editable_application: { Args: never; Returns: string }
      lock_own_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      log_audit: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      mark_deletion_notified: {
        Args: { p_deletion_id: string; p_error?: string }
        Returns: undefined
      }
      next_order_code: { Args: { p_seller_id: string }; Returns: string }
      next_receipt_code: { Args: { p_seller_id: string }; Returns: string }
      normalize_product_name: { Args: { p_name: string }; Returns: string }
      order_cogs: { Args: { p_order_id: string }; Returns: number }
      paths_owned_by: {
        Args: { p_owner: string; p_paths: string[] }
        Returns: boolean
      }
      post_purchase_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      purge_expired_trash: { Args: never; Returns: string[] }
      purge_trash: { Args: { p_ids: string[] }; Returns: string[] }
      register_as_seller: { Args: never; Returns: string }
      reorder_categories: { Args: { p_ids: string[] }; Returns: undefined }
      report_bounds: {
        Args: { p_from: string; p_to: string; p_tz: string }
        Returns: {
          prev_start: string
          range_end: string
          range_start: string
        }[]
      }
      request_account_deletion: {
        Args: { p_evidence?: Json; p_reason: string; p_user_id: string }
        Returns: string
      }
      require_admin: { Args: never; Returns: undefined }
      require_approved_seller: { Args: never; Returns: string }
      require_category_editor: { Args: never; Returns: string }
      require_reason: { Args: { p_reason: string }; Returns: string }
      resolve_report_seller: { Args: { p_seller_id: string }; Returns: string }
      restore_account: {
        Args: { p_deletion_id: string; p_note?: string }
        Returns: undefined
      }
      restore_products: { Args: { p_ids: string[] }; Returns: Json }
      review_seller: {
        Args: { p_decision: string; p_reason?: string; p_seller_id: string }
        Returns: undefined
      }
      save_purchase_receipt: {
        Args: { p_header: Json; p_items: Json; p_receipt_id: string }
        Returns: string
      }
      save_seller_application: {
        Args: { p_data: Json; p_step?: number }
        Returns: undefined
      }
      seller_status_can_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["seller_status"]
          p_to: Database["public"]["Enums"]["seller_status"]
        }
        Returns: boolean
      }
      set_account_locked: {
        Args: { p_locked: boolean; p_reason?: string; p_user_id: string }
        Returns: undefined
      }
      set_seller_suspended: {
        Args: { p_reason?: string; p_seller_id: string; p_suspended: boolean }
        Returns: undefined
      }
      ship_order: { Args: { p_order_id: string }; Returns: undefined }
      sku_name_part: { Args: { p_name: string }; Returns: string }
      sku_sequence: { Args: { p_sku: string }; Returns: number }
      slugify: { Args: { p_text: string }; Returns: string }
      submit_seller_application: {
        Args: { p_terms_version: string }
        Returns: undefined
      }
      trash_products: { Args: { p_ids: string[] }; Returns: Json }
      unique_category_slug: {
        Args: { p_category_id: string; p_name: string; p_seller_id: string }
        Returns: string
      }
      unique_seller_slug: {
        Args: { p_seller_id: string; p_shop_name: string }
        Returns: string
      }
      update_category: {
        Args: { p_id: string; p_is_active?: boolean; p_name: string }
        Returns: undefined
      }
    }
    Enums: {
      account_deletion_status: "pending" | "confirmed" | "restored"
      account_status: "active" | "pending_deletion" | "deleted"
      business_type: "household" | "company" | "individual"
      order_status:
        | "pending"
        | "confirmed"
        | "shipping"
        | "delivered"
        | "cancelled"
      payment_method: "cod" | "bank_transfer" | "cash" | "card" | "e_wallet"
      receipt_status: "draft" | "posted"
      seller_document_kind: "business_license" | "representative_id"
      seller_status: "draft" | "pending" | "approved" | "rejected" | "suspended"
      user_role: "admin" | "seller" | "customer"
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
      account_deletion_status: ["pending", "confirmed", "restored"],
      account_status: ["active", "pending_deletion", "deleted"],
      business_type: ["household", "company", "individual"],
      order_status: [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod", "bank_transfer", "cash", "card", "e_wallet"],
      receipt_status: ["draft", "posted"],
      seller_document_kind: ["business_license", "representative_id"],
      seller_status: ["draft", "pending", "approved", "rejected", "suspended"],
      user_role: ["admin", "seller", "customer"],
    },
  },
} as const
