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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          id: string
          record_id: string | null
          table_name: string
          tenant_id: string
          ts: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
          tenant_id: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
          tenant_id?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dias_operativos: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          fecha: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["dia_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          fecha: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["dia_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          fecha?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["dia_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_operativos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_price_history: {
        Row: {
          created_by: string | null
          id: string
          insumo_id: string
          price: number
          source: string
          source_id: string | null
          tenant_id: string
          valid_from: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          insumo_id: string
          price: number
          source: string
          source_id?: string | null
          tenant_id: string
          valid_from?: string
        }
        Update: {
          created_by?: string | null
          id?: string
          insumo_id?: string
          price?: number
          source?: string
          source_id?: string | null
          tenant_id?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_price_history_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          active: boolean
          created_at: string
          current_price: number
          id: string
          name: string
          perishable: boolean
          proveedor_id: string | null
          shelf_life_days: number | null
          tenant_id: string
          unit: Database["public"]["Enums"]["unit_kind"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_price?: number
          id?: string
          name: string
          perishable?: boolean
          proveedor_id?: string | null
          shelf_life_days?: number | null
          tenant_id: string
          unit: Database["public"]["Enums"]["unit_kind"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          perishable?: boolean
          proveedor_id?: string | null
          shelf_life_days?: number | null
          tenant_id?: string
          unit?: Database["public"]["Enums"]["unit_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_diarios: {
        Row: {
          almuerzo: number
          conteo_fisico: number | null
          created_at: string
          desperdicio: number
          dia_id: string
          diferencia: number | null
          id: string
          produccion: number
          producto_id: string
          stock_anterior: number
          stock_calculado: number | null
          updated_at: string
          ventas: number
        }
        Insert: {
          almuerzo?: number
          conteo_fisico?: number | null
          created_at?: string
          desperdicio?: number
          dia_id: string
          diferencia?: number | null
          id?: string
          produccion?: number
          producto_id: string
          stock_anterior?: number
          stock_calculado?: number | null
          updated_at?: string
          ventas?: number
        }
        Update: {
          almuerzo?: number
          conteo_fisico?: number | null
          created_at?: string
          desperdicio?: number
          dia_id?: string
          diferencia?: number | null
          id?: string
          produccion?: number
          producto_id?: string
          stock_anterior?: number
          stock_calculado?: number | null
          updated_at?: string
          ventas?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_diarios_dia_id_fkey"
            columns: ["dia_id"]
            isOneToOne: false
            referencedRelation: "dias_operativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_diarios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          active: boolean
          created_at: string
          descartable_cost: number
          id: string
          is_dynamic: boolean
          name: string
          receta_id: string | null
          sale_price: number
          target_margin_pct: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          descartable_cost?: number
          id?: string
          is_dynamic?: boolean
          name: string
          receta_id?: string | null
          sale_price?: number
          target_margin_pct?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          descartable_cost?: number
          id?: string
          is_dynamic?: boolean
          name?: string
          receta_id?: string | null
          sale_price?: number
          target_margin_pct?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          payment_terms_days: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          payment_terms_days?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          payment_terms_days?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receta_ingredientes: {
        Row: {
          created_at: string
          id: string
          insumo_id: string | null
          kind: Database["public"]["Enums"]["ingrediente_kind"]
          qty: number
          receta_id: string
          sub_receta_id: string | null
          unit: Database["public"]["Enums"]["unit_kind"]
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          kind: Database["public"]["Enums"]["ingrediente_kind"]
          qty: number
          receta_id: string
          sub_receta_id?: string | null
          unit: Database["public"]["Enums"]["unit_kind"]
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          kind?: Database["public"]["Enums"]["ingrediente_kind"]
          qty?: number
          receta_id?: string
          sub_receta_id?: string | null
          unit?: Database["public"]["Enums"]["unit_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "receta_ingredientes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receta_ingredientes_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receta_ingredientes_sub_receta_id_fkey"
            columns: ["sub_receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
        ]
      }
      recetas: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string
          yield_qty: number
          yield_unit: Database["public"]["Enums"]["unit_kind"]
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
          yield_qty?: number
          yield_unit?: Database["public"]["Enums"]["unit_kind"]
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          yield_qty?: number
          yield_unit?: Database["public"]["Enums"]["unit_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "recetas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_config: {
        Row: {
          key: string
          tenant_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          tenant_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          tenant_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenant_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          config: Json
          created_at: string
          currency: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          currency?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          currency?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_costs: {
        Row: {
          active: boolean | null
          descartable_cost: number | null
          id: string | null
          is_dynamic: boolean | null
          margin_pct: number | null
          name: string | null
          receta_id: string | null
          receta_name: string | null
          sale_price: number | null
          target_margin_pct: number | null
          tenant_id: string | null
          total_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      abrir_dia: {
        Args: { p_fecha: string; p_tenant_id: string }
        Returns: string
      }
      cerrar_dia: { Args: { p_dia_id: string }; Returns: undefined }
      current_tenant_ids: { Args: never; Returns: string[] }
      recipe_cost: { Args: { p_receta_id: string }; Returns: number }
      recipe_has_cycle: {
        Args: { p_receta_id: string; p_sub_receta_id: string }
        Returns: boolean
      }
    }
    Enums: {
      dia_status: "abierto" | "cerrado"
      ingrediente_kind: "insumo" | "receta"
      membership_role: "owner" | "admin" | "kitchen" | "cashier"
      membership_status: "active" | "inactive" | "invited"
      unit_kind: "kg" | "g" | "l" | "ml" | "u" | "docena" | "porcion"
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
      dia_status: ["abierto", "cerrado"],
      ingrediente_kind: ["insumo", "receta"],
      membership_role: ["owner", "admin", "kitchen", "cashier"],
      membership_status: ["active", "inactive", "invited"],
      unit_kind: ["kg", "g", "l", "ml", "u", "docena", "porcion"],
    },
  },
} as const
