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
      bistro_credentials: {
        Row: {
          created_at: string
          last_token: string | null
          last_token_expires_at: string | null
          password_secret_id: string | null
          shop_code: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          username: string
        }
        Insert: {
          created_at?: string
          last_token?: string | null
          last_token_expires_at?: string | null
          password_secret_id?: string | null
          shop_code?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          username: string
        }
        Update: {
          created_at?: string
          last_token?: string | null
          last_token_expires_at?: string | null
          password_secret_id?: string | null
          shop_code?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "bistro_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bistro_sync_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          pages_fetched: number
          range_from: string
          range_to: string
          shop_codes: string[] | null
          started_at: string
          status: string
          tenant_id: string
          transactions_inserted: number
          transactions_updated: number
          triggered_by: string | null
          unmapped_items_count: number
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          pages_fetched?: number
          range_from: string
          range_to: string
          shop_codes?: string[] | null
          started_at?: string
          status: string
          tenant_id: string
          transactions_inserted?: number
          transactions_updated?: number
          triggered_by?: string | null
          unmapped_items_count?: number
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          pages_fetched?: number
          range_from?: string
          range_to?: string
          shop_codes?: string[] | null
          started_at?: string
          status?: string
          tenant_id?: string
          transactions_inserted?: number
          transactions_updated?: number
          triggered_by?: string | null
          unmapped_items_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bistro_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bistro_transaccion_items: {
        Row: {
          amount: number
          comments: string | null
          id: string
          item_name: string
          line_type: string
          measure_unit: string | null
          producto_id: string | null
          quantity: number
          sku: string | null
          tenant_id: string
          transaccion_id: string
          vat: number | null
        }
        Insert: {
          amount: number
          comments?: string | null
          id?: string
          item_name: string
          line_type: string
          measure_unit?: string | null
          producto_id?: string | null
          quantity: number
          sku?: string | null
          tenant_id: string
          transaccion_id: string
          vat?: number | null
        }
        Update: {
          amount?: number
          comments?: string | null
          id?: string
          item_name?: string
          line_type?: string
          measure_unit?: string | null
          producto_id?: string | null
          quantity?: number
          sku?: string | null
          tenant_id?: string
          transaccion_id?: string
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bistro_transaccion_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bistro_transaccion_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bistro_transaccion_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bistro_transaccion_items_transaccion_id_fkey"
            columns: ["transaccion_id"]
            isOneToOne: false
            referencedRelation: "bistro_transacciones"
            referencedColumns: ["id"]
          },
        ]
      }
      bistro_transacciones: {
        Row: {
          amount_total: number
          client_name: string | null
          comments: string | null
          fecha_hora: string
          fecha_local: string | null
          id: string
          origin: string | null
          payment_method: string | null
          raw_payload: Json
          shop_code: string
          synced_at: string
          tenant_id: string
          ticket_number: number
          transaction_type: string
          user_name: string | null
        }
        Insert: {
          amount_total: number
          client_name?: string | null
          comments?: string | null
          fecha_hora: string
          fecha_local?: string | null
          id?: string
          origin?: string | null
          payment_method?: string | null
          raw_payload: Json
          shop_code: string
          synced_at?: string
          tenant_id: string
          ticket_number: number
          transaction_type: string
          user_name?: string | null
        }
        Update: {
          amount_total?: number
          client_name?: string | null
          comments?: string | null
          fecha_hora?: string
          fecha_local?: string | null
          id?: string
          origin?: string | null
          payment_method?: string | null
          raw_payload?: Json
          shop_code?: string
          synced_at?: string
          tenant_id?: string
          ticket_number?: number
          transaction_type?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bistro_transacciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_movimientos: {
        Row: {
          categoria: string
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          monto: number
          ref_id: string | null
          ref_kind: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["caja_tipo"]
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto: number
          ref_id?: string | null
          ref_kind?: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["caja_tipo"]
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number
          ref_id?: string | null
          ref_kind?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["caja_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_movimientos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cierre_caja_productos: {
        Row: {
          cantidad: number
          categoria: string | null
          cierre_caja_id: string
          created_at: string
          id: string
          monto_total: number
          nombre: string
          producto_id: string | null
        }
        Insert: {
          cantidad?: number
          categoria?: string | null
          cierre_caja_id: string
          created_at?: string
          id?: string
          monto_total?: number
          nombre: string
          producto_id?: string | null
        }
        Update: {
          cantidad?: number
          categoria?: string | null
          cierre_caja_id?: string
          created_at?: string
          id?: string
          monto_total?: number
          nombre?: string
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cierre_caja_productos_cierre_caja_id_fkey"
            columns: ["cierre_caja_id"]
            isOneToOne: false
            referencedRelation: "cierres_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierre_caja_productos_cierre_caja_id_fkey"
            columns: ["cierre_caja_id"]
            isOneToOne: false
            referencedRelation: "cierres_caja_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierre_caja_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierre_caja_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      cierres_caja: {
        Row: {
          cantidad_comandas: number
          cantidad_ventas: number
          created_at: string
          created_by: string | null
          cubiertos: number
          dia_operativo_id: string | null
          efectivo_apertura: number
          efectivo_cierre: number
          fecha_apertura: string
          fecha_cierre: string
          fecha_cierre_local: string | null
          id: string
          monto_cuenta_cliente: number
          monto_efectivo: number
          monto_mostrador: number
          monto_online: number
          monto_qr: number
          monto_salon: number
          monto_tarjetas: number
          operador: string | null
          raw_payload: Json | null
          razon_social: string | null
          shop_code: string | null
          source: string
          tenant_id: string
          ticket_promedio: number
          total_comandas: number
          total_depositos: number
          total_retiros: number
          total_vendido: number
          total_ventas: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cantidad_comandas?: number
          cantidad_ventas?: number
          created_at?: string
          created_by?: string | null
          cubiertos?: number
          dia_operativo_id?: string | null
          efectivo_apertura?: number
          efectivo_cierre?: number
          fecha_apertura: string
          fecha_cierre: string
          fecha_cierre_local?: string | null
          id?: string
          monto_cuenta_cliente?: number
          monto_efectivo?: number
          monto_mostrador?: number
          monto_online?: number
          monto_qr?: number
          monto_salon?: number
          monto_tarjetas?: number
          operador?: string | null
          raw_payload?: Json | null
          razon_social?: string | null
          shop_code?: string | null
          source?: string
          tenant_id: string
          ticket_promedio?: number
          total_comandas?: number
          total_depositos?: number
          total_retiros?: number
          total_vendido?: number
          total_ventas?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cantidad_comandas?: number
          cantidad_ventas?: number
          created_at?: string
          created_by?: string | null
          cubiertos?: number
          dia_operativo_id?: string | null
          efectivo_apertura?: number
          efectivo_cierre?: number
          fecha_apertura?: string
          fecha_cierre?: string
          fecha_cierre_local?: string | null
          id?: string
          monto_cuenta_cliente?: number
          monto_efectivo?: number
          monto_mostrador?: number
          monto_online?: number
          monto_qr?: number
          monto_salon?: number
          monto_tarjetas?: number
          operador?: string | null
          raw_payload?: Json | null
          razon_social?: string | null
          shop_code?: string | null
          source?: string
          tenant_id?: string
          ticket_promedio?: number
          total_comandas?: number
          total_depositos?: number
          total_retiros?: number
          total_vendido?: number
          total_ventas?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cierres_caja_dia_operativo_id_fkey"
            columns: ["dia_operativo_id"]
            isOneToOne: false
            referencedRelation: "dias_operativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierres_caja_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_items: {
        Row: {
          compra_id: string
          created_at: string
          id: string
          insumo_id: string
          qty: number
          unit: Database["public"]["Enums"]["unit_kind"]
          unit_price: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          id?: string
          insumo_id: string
          qty: number
          unit: Database["public"]["Enums"]["unit_kind"]
          unit_price: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          id?: string
          insumo_id?: string
          qty?: number
          unit?: Database["public"]["Enums"]["unit_kind"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_items_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo_stock"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "compra_items_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          due_date: string | null
          fecha: string
          id: string
          notes: string | null
          proveedor_id: string
          status: Database["public"]["Enums"]["compra_status"]
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          fecha?: string
          id?: string
          notes?: string | null
          proveedor_id: string
          status?: Database["public"]["Enums"]["compra_status"]
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          fecha?: string
          id?: string
          notes?: string | null
          proveedor_id?: string
          status?: Database["public"]["Enums"]["compra_status"]
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "saldos_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_tenant_id_fkey"
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
      empleado_ausencias: {
        Row: {
          created_at: string
          empleado_id: string
          fecha: string
          id: string
          notas: string | null
          paga: boolean
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          fecha: string
          id?: string
          notas?: string | null
          paga?: boolean
          tenant_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          fecha?: string
          id?: string
          notas?: string | null
          paga?: boolean
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_ausencias_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_ausencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_horarios: {
        Row: {
          dow: number
          empleado_id: string
          hora_fin: string
          hora_inicio: string
          id: string
          tenant_id: string
        }
        Insert: {
          dow: number
          empleado_id: string
          hora_fin: string
          hora_inicio: string
          id?: string
          tenant_id: string
        }
        Update: {
          dow?: number
          empleado_id?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_horarios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_horarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_liquidaciones: {
        Row: {
          caja_movimiento_id: string | null
          created_at: string
          dias_ausentes_pagos: number
          dias_programados: number
          dias_trabajados: number
          empleado_id: string
          fecha_desde: string
          fecha_hasta: string
          id: string
          monto_plus: number
          monto_sueldo: number
          monto_total: number | null
          notas: string | null
          tenant_id: string
        }
        Insert: {
          caja_movimiento_id?: string | null
          created_at?: string
          dias_ausentes_pagos: number
          dias_programados: number
          dias_trabajados: number
          empleado_id: string
          fecha_desde: string
          fecha_hasta: string
          id?: string
          monto_plus?: number
          monto_sueldo: number
          monto_total?: number | null
          notas?: string | null
          tenant_id: string
        }
        Update: {
          caja_movimiento_id?: string | null
          created_at?: string
          dias_ausentes_pagos?: number
          dias_programados?: number
          dias_trabajados?: number
          empleado_id?: string
          fecha_desde?: string
          fecha_hasta?: string
          id?: string
          monto_plus?: number
          monto_sueldo?: number
          monto_total?: number | null
          notas?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_liquidaciones_caja_movimiento_id_fkey"
            columns: ["caja_movimiento_id"]
            isOneToOne: false
            referencedRelation: "caja_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_liquidaciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_liquidaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_vacaciones: {
        Row: {
          cancelada: boolean
          created_at: string
          empleado_id: string
          fecha_desde: string
          fecha_hasta: string
          id: string
          notas: string | null
          tenant_id: string
        }
        Insert: {
          cancelada?: boolean
          created_at?: string
          empleado_id: string
          fecha_desde: string
          fecha_hasta: string
          id?: string
          notas?: string | null
          tenant_id: string
        }
        Update: {
          cancelada?: boolean
          created_at?: string
          empleado_id?: string
          fecha_desde?: string
          fecha_hasta?: string
          id?: string
          notas?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_vacaciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_vacaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          aguinaldo_estimado: number
          created_at: string
          fecha_ingreso: string | null
          id: string
          name: string
          notas: string | null
          plus_mensual: number
          sueldo_diario: number
          tenant_id: string
          updated_at: string
          vacaciones_dias_anuales: number
        }
        Insert: {
          activo?: boolean
          aguinaldo_estimado?: number
          created_at?: string
          fecha_ingreso?: string | null
          id?: string
          name: string
          notas?: string | null
          plus_mensual?: number
          sueldo_diario?: number
          tenant_id: string
          updated_at?: string
          vacaciones_dias_anuales?: number
        }
        Update: {
          activo?: boolean
          aguinaldo_estimado?: number
          created_at?: string
          fecha_ingreso?: string | null
          id?: string
          name?: string
          notas?: string | null
          plus_mensual?: number
          sueldo_diario?: number
          tenant_id?: string
          updated_at?: string
          vacaciones_dias_anuales?: number
        }
        Relationships: [
          {
            foreignKeyName: "empleados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_review_snapshots: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          latest_reviews: Json
          place_id: string
          rating: number
          tenant_id: string
          total_reviews: number
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          latest_reviews?: Json
          place_id: string
          rating: number
          tenant_id: string
          total_reviews: number
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          latest_reviews?: Json
          place_id?: string
          rating?: number
          tenant_id?: string
          total_reviews?: number
        }
        Relationships: [
          {
            foreignKeyName: "google_review_snapshots_tenant_id_fkey"
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
          proveedor_id: string | null
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
          proveedor_id?: string | null
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
          proveedor_id?: string | null
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
            referencedRelation: "insumo_stock"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "insumo_price_history_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_price_history_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_price_history_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "saldos_proveedores"
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
      insumo_stock_ajustes: {
        Row: {
          created_at: string
          created_by: string | null
          diferencia: number | null
          id: string
          insumo_id: string
          notas: string | null
          stock_real: number
          stock_teorico: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diferencia?: number | null
          id?: string
          insumo_id: string
          notas?: string | null
          stock_real: number
          stock_teorico: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diferencia?: number | null
          id?: string
          insumo_id?: string
          notas?: string | null
          stock_real?: number
          stock_teorico?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_stock_ajustes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo_stock"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "insumo_stock_ajustes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_stock_ajustes_tenant_id_fkey"
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
          kind: string
          name: string
          perishable: boolean
          proveedor_id: string | null
          purchase_unit_factor: number | null
          purchase_unit_label: string | null
          shelf_life_days: number | null
          stock_inicial: number
          tenant_id: string
          track_stock: boolean
          unit: Database["public"]["Enums"]["unit_kind"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_price?: number
          id?: string
          kind?: string
          name: string
          perishable?: boolean
          proveedor_id?: string | null
          purchase_unit_factor?: number | null
          purchase_unit_label?: string | null
          shelf_life_days?: number | null
          stock_inicial?: number
          tenant_id: string
          track_stock?: boolean
          unit: Database["public"]["Enums"]["unit_kind"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          current_price?: number
          id?: string
          kind?: string
          name?: string
          perishable?: boolean
          proveedor_id?: string | null
          purchase_unit_factor?: number | null
          purchase_unit_label?: string | null
          shelf_life_days?: number | null
          stock_inicial?: number
          tenant_id?: string
          track_stock?: boolean
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
            foreignKeyName: "insumos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "saldos_proveedores"
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
            referencedRelation: "product_costs"
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
      pagos_proveedor: {
        Row: {
          cleared_at: string | null
          compra_id: string | null
          created_at: string
          descripcion: string | null
          due_date: string | null
          fecha: string
          id: string
          metodo: Database["public"]["Enums"]["pago_metodo"]
          monto: number
          proveedor_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cleared_at?: string | null
          compra_id?: string | null
          created_at?: string
          descripcion?: string | null
          due_date?: string | null
          fecha?: string
          id?: string
          metodo?: Database["public"]["Enums"]["pago_metodo"]
          monto: number
          proveedor_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cleared_at?: string | null
          compra_id?: string | null
          created_at?: string
          descripcion?: string | null
          due_date?: string | null
          fecha?: string
          id?: string
          metodo?: Database["public"]["Enums"]["pago_metodo"]
          monto?: number
          proveedor_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "saldos_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_aliases: {
        Row: {
          alias: string
          created_at: string
          created_by: string | null
          id: string
          producto_id: string
          source: string
          tenant_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          created_by?: string | null
          id?: string
          producto_id: string
          source?: string
          tenant_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          created_by?: string | null
          id?: string
          producto_id?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_aliases_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_aliases_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_aliases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_descartables: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          producto_id: string
          qty: number
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          producto_id: string
          qty: number
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          producto_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "producto_descartables_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo_stock"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "producto_descartables_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_descartables_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_descartables_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_price_history: {
        Row: {
          created_by: string | null
          id: string
          margin_pct: number | null
          producto_id: string
          sale_price: number
          tenant_id: string
          total_cost: number | null
          valid_from: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          margin_pct?: number | null
          producto_id: string
          sale_price: number
          tenant_id: string
          total_cost?: number | null
          valid_from?: string
        }
        Update: {
          created_by?: string | null
          id?: string
          margin_pct?: number | null
          producto_id?: string
          sale_price?: number
          tenant_id?: string
          total_cost?: number | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_price_history_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_price_history_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          active: boolean
          created_at: string
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
          discrimina_iva: boolean
          id: string
          name: string
          notes: string | null
          payment_rule: Json | null
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
          discrimina_iva?: boolean
          id?: string
          name: string
          notes?: string | null
          payment_rule?: Json | null
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
          discrimina_iva?: boolean
          id?: string
          name?: string
          notes?: string | null
          payment_rule?: Json | null
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
            referencedRelation: "insumo_stock"
            referencedColumns: ["insumo_id"]
          },
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
      cierre_caja_productos_active: {
        Row: {
          cantidad: number | null
          categoria: string | null
          cierre_caja_id: string | null
          cierre_fecha_cierre: string | null
          cierre_fecha_local: string | null
          cierre_shop_code: string | null
          cierre_source: string | null
          cierre_tenant_id: string | null
          id: string | null
          monto_total: number | null
          nombre: string | null
          producto_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cierre_caja_productos_cierre_caja_id_fkey"
            columns: ["cierre_caja_id"]
            isOneToOne: false
            referencedRelation: "cierres_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierre_caja_productos_cierre_caja_id_fkey"
            columns: ["cierre_caja_id"]
            isOneToOne: false
            referencedRelation: "cierres_caja_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierre_caja_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierre_caja_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierres_caja_tenant_id_fkey"
            columns: ["cierre_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cierres_caja_active: {
        Row: {
          cantidad_comandas: number | null
          cantidad_ventas: number | null
          created_at: string | null
          created_by: string | null
          cubiertos: number | null
          dia_operativo_id: string | null
          efectivo_apertura: number | null
          efectivo_cierre: number | null
          fecha_apertura: string | null
          fecha_cierre: string | null
          fecha_cierre_local: string | null
          id: string | null
          monto_cuenta_cliente: number | null
          monto_efectivo: number | null
          monto_mostrador: number | null
          monto_online: number | null
          monto_qr: number | null
          monto_salon: number | null
          monto_tarjetas: number | null
          operador: string | null
          raw_payload: Json | null
          razon_social: string | null
          shop_code: string | null
          source: string | null
          tenant_id: string | null
          ticket_promedio: number | null
          total_comandas: number | null
          total_depositos: number | null
          total_retiros: number | null
          total_vendido: number | null
          total_ventas: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cierres_caja_dia_operativo_id_fkey"
            columns: ["dia_operativo_id"]
            isOneToOne: false
            referencedRelation: "dias_operativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierres_caja_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_stock: {
        Row: {
          insumo_id: string | null
          stock_actual: number | null
          stock_consumido: number | null
          stock_referencia: number | null
          tenant_id: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          active: boolean | null
          descartable_cost: number | null
          id: string | null
          ingredient_cost: number | null
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
      saldos_proveedores: {
        Row: {
          active: boolean | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          d0_30: number | null
          d31_60: number | null
          d61_90: number | null
          d90plus: number | null
          discrimina_iva: boolean | null
          id: string | null
          name: string | null
          notes: string | null
          payment_rule: Json | null
          payment_terms_days: number | null
          saldo: number | null
          tenant_id: string | null
          total_compras: number | null
          total_pagado: number | null
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
    }
    Functions: {
      abrir_dia: {
        Args: { p_fecha: string; p_tenant_id: string }
        Returns: string
      }
      bistro_clear_credentials: { Args: never; Returns: undefined }
      bistro_get_credentials: {
        Args: { p_tenant_id: string }
        Returns: {
          last_token: string
          last_token_expires_at: string
          password: string
          shop_code: string
          tenant_id: string
          username: string
        }[]
      }
      bistro_save_credentials: {
        Args: { p_password: string; p_shop_code?: string; p_username: string }
        Returns: undefined
      }
      bistro_update_token: {
        Args: { p_expires_at: string; p_tenant_id: string; p_token: string }
        Returns: undefined
      }
      cerrar_dia: { Args: { p_dia_id: string }; Returns: undefined }
      current_tenant_ids: { Args: never; Returns: string[] }
      normalize_name: { Args: { p_name: string }; Returns: string }
      normalize_qty: {
        Args: { from_unit: string; qty: number; to_unit: string }
        Returns: number
      }
      recipe_cost: { Args: { p_receta_id: string }; Returns: number }
      recipe_has_cycle: {
        Args: { p_receta_id: string; p_sub_receta_id: string }
        Returns: boolean
      }
    }
    Enums: {
      caja_tipo: "ingreso" | "egreso"
      compra_status: "pendiente" | "pagada_parcial" | "pagada"
      dia_status: "abierto" | "cerrado"
      ingrediente_kind: "insumo" | "receta"
      membership_role: "owner" | "admin" | "kitchen" | "cashier"
      membership_status: "active" | "inactive" | "invited"
      pago_metodo: "efectivo" | "transferencia" | "cheque" | "otro"
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
      caja_tipo: ["ingreso", "egreso"],
      compra_status: ["pendiente", "pagada_parcial", "pagada"],
      dia_status: ["abierto", "cerrado"],
      ingrediente_kind: ["insumo", "receta"],
      membership_role: ["owner", "admin", "kitchen", "cashier"],
      membership_status: ["active", "inactive", "invited"],
      pago_metodo: ["efectivo", "transferencia", "cheque", "otro"],
      unit_kind: ["kg", "g", "l", "ml", "u", "docena", "porcion"],
    },
  },
} as const

