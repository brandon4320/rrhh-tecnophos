// ============================================================
// Tipos generados desde la base de datos Supabase.
// NO editar a mano. Regenerar con:
//   (MCP) generate_typescript_types  ó
//   supabase gen types typescript --project-id feccpqcmwtsnbhnnhqwg
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      archivos: {
        Row: {
          certificado_id: string | null
          id: string
          mime_type: string | null
          nombre: string
          path: string
          size_bytes: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          certificado_id?: string | null
          id?: string
          mime_type?: string | null
          nombre: string
          path: string
          size_bytes?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          certificado_id?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string
          path?: string
          size_bytes?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archivos_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "certificados"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          alerta_dias: number | null
          created_at: string | null
          empleado_id: string | null
          empresa_id: string | null
          equipo_id: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: string
          notas: string | null
          numero_documento: string | null
          tipo_id: string | null
          tipo_nombre_custom: string | null
          updated_at: string | null
          vehiculo_id: string | null
        }
        Insert: {
          alerta_dias?: number | null
          created_at?: string | null
          empleado_id?: string | null
          empresa_id?: string | null
          equipo_id?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          notas?: string | null
          numero_documento?: string | null
          tipo_id?: string | null
          tipo_nombre_custom?: string | null
          updated_at?: string | null
          vehiculo_id?: string | null
        }
        Update: {
          alerta_dias?: number | null
          created_at?: string | null
          empleado_id?: string | null
          empresa_id?: string | null
          equipo_id?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          notas?: string | null
          numero_documento?: string | null
          tipo_id?: string | null
          tipo_nombre_custom?: string | null
          updated_at?: string | null
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificados_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "equipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_certificado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          clave: string
          updated_at: string | null
          valor: string
        }
        Insert: {
          clave: string
          updated_at?: string | null
          valor: string
        }
        Update: {
          clave?: string
          updated_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      empleados: {
        Row: {
          activo: boolean | null
          apellido: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          nombre: string
          sector: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nombre: string
          sector?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nombre?: string
          sector?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empleados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_modulos: {
        Row: {
          empresa_id: string
          habilitado: boolean | null
          modulo: string
        }
        Insert: {
          empresa_id: string
          habilitado?: boolean | null
          modulo: string
        }
        Update: {
          empresa_id?: string
          habilitado?: boolean | null
          modulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      limpieza_areas: {
        Row: {
          activo: boolean | null
          created_at: string | null
          frecuencia: string | null
          id: string
          nombre: string
          prioridad: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          frecuencia?: string | null
          id?: string
          nombre: string
          prioridad?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          frecuencia?: string | null
          id?: string
          nombre?: string
          prioridad?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      limpieza_asignaciones: {
        Row: {
          area_id: string
          created_at: string | null
          created_by: string | null
          estado: string
          fecha: string
          id: string
          notas: string | null
          personal_id: string
          updated_at: string | null
        }
        Insert: {
          area_id: string
          created_at?: string | null
          created_by?: string | null
          estado?: string
          fecha: string
          id?: string
          notas?: string | null
          personal_id: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string | null
          created_by?: string | null
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          personal_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_asignaciones_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "limpieza_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpieza_asignaciones_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "limpieza_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_asistencia: {
        Row: {
          confirmado_at: string | null
          confirmado_por: string | null
          created_at: string | null
          created_by: string | null
          cubre_a: string | null
          estado: string
          fecha: string
          horas_extra: number | null
          id: string
          observaciones: string | null
          personal_id: string
          updated_at: string | null
        }
        Insert: {
          confirmado_at?: string | null
          confirmado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          cubre_a?: string | null
          estado?: string
          fecha: string
          horas_extra?: number | null
          id?: string
          observaciones?: string | null
          personal_id: string
          updated_at?: string | null
        }
        Update: {
          confirmado_at?: string | null
          confirmado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          cubre_a?: string | null
          estado?: string
          fecha?: string
          horas_extra?: number | null
          id?: string
          observaciones?: string | null
          personal_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_asistencia_cubre_a_fkey"
            columns: ["cubre_a"]
            isOneToOne: false
            referencedRelation: "limpieza_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpieza_asistencia_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "limpieza_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_consumible_mov: {
        Row: {
          consumible_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notas: string | null
          pct_anterior: number | null
          pct_nuevo: number | null
          tipo: string | null
        }
        Insert: {
          consumible_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notas?: string | null
          pct_anterior?: number | null
          pct_nuevo?: number | null
          tipo?: string | null
        }
        Update: {
          consumible_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notas?: string | null
          pct_anterior?: number | null
          pct_nuevo?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_consumible_mov_consumible_id_fkey"
            columns: ["consumible_id"]
            isOneToOne: false
            referencedRelation: "limpieza_consumibles"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_consumibles: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          minimo_pct: number
          nombre: string
          provee: string | null
          stock_pct: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          minimo_pct?: number
          nombre: string
          provee?: string | null
          stock_pct?: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          minimo_pct?: number
          nombre?: string
          provee?: string | null
          stock_pct?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      limpieza_cronograma: {
        Row: {
          area_id: string
          created_at: string | null
          created_by: string | null
          dia: number
          id: string
          personal_id: string
          semana: string
          turno: string | null
          updated_at: string | null
        }
        Insert: {
          area_id: string
          created_at?: string | null
          created_by?: string | null
          dia: number
          id?: string
          personal_id: string
          semana: string
          turno?: string | null
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string | null
          created_by?: string | null
          dia?: number
          id?: string
          personal_id?: string
          semana?: string
          turno?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_cronograma_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "limpieza_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpieza_cronograma_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "limpieza_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_feedback: {
        Row: {
          area_id: string | null
          cerrado_at: string | null
          created_at: string | null
          created_by: string | null
          descripcion: string
          estado: string
          evidencia_url: string | null
          fecha: string | null
          id: string
          prioridad: string
          registrado_por: string | null
          respuesta_adc: string | null
          sector: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          cerrado_at?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion: string
          estado?: string
          evidencia_url?: string | null
          fecha?: string | null
          id?: string
          prioridad?: string
          registrado_por?: string | null
          respuesta_adc?: string | null
          sector?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          cerrado_at?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion?: string
          estado?: string
          evidencia_url?: string | null
          fecha?: string | null
          id?: string
          prioridad?: string
          registrado_por?: string | null
          respuesta_adc?: string | null
          sector?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_feedback_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "limpieza_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_tiempos: {
        Row: {
          area_id: string | null
          created_at: string | null
          created_by: string | null
          duracion_min: number | null
          estado: string
          fecha: string
          fin: string | null
          id: string
          inicio: string | null
          notas: string | null
          personal_id: string
          updated_at: string | null
          validado_por: string | null
        }
        Insert: {
          area_id?: string | null
          created_at?: string | null
          created_by?: string | null
          duracion_min?: number | null
          estado?: string
          fecha: string
          fin?: string | null
          id?: string
          inicio?: string | null
          notas?: string | null
          personal_id: string
          updated_at?: string | null
          validado_por?: string | null
        }
        Update: {
          area_id?: string | null
          created_at?: string | null
          created_by?: string | null
          duracion_min?: number | null
          estado?: string
          fecha?: string
          fin?: string | null
          id?: string
          inicio?: string | null
          notas?: string | null
          personal_id?: string
          updated_at?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_tiempos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "limpieza_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpieza_tiempos_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "limpieza_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_personal: {
        Row: {
          activo: boolean | null
          apellido: string | null
          created_at: string | null
          funcion: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          funcion?: string | null
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          funcion?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      limpieza_reportes: {
        Row: {
          created_at: string | null
          created_by: string | null
          dotacion_planificada: number | null
          dotacion_presente: number | null
          estado_consumibles: string | null
          fecha: string
          firmado_at: string | null
          firmado_por: string | null
          id: string
          incidencias: string | null
          observaciones: string | null
          tareas_resumen: Json | null
          turno_fin: string | null
          turno_inicio: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dotacion_planificada?: number | null
          dotacion_presente?: number | null
          estado_consumibles?: string | null
          fecha: string
          firmado_at?: string | null
          firmado_por?: string | null
          id?: string
          incidencias?: string | null
          observaciones?: string | null
          tareas_resumen?: Json | null
          turno_fin?: string | null
          turno_inicio?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dotacion_planificada?: number | null
          dotacion_presente?: number | null
          estado_consumibles?: string | null
          fecha?: string
          firmado_at?: string | null
          firmado_por?: string | null
          id?: string
          incidencias?: string | null
          observaciones?: string | null
          tareas_resumen?: Json | null
          turno_fin?: string | null
          turno_inicio?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          created_at: string | null
          empresa_acceso: string | null
          id: string
          nombre: string | null
          rol: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_acceso?: string | null
          id: string
          nombre?: string | null
          rol?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_acceso?: string | null
          id?: string
          nombre?: string | null
          rol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_empresa_acceso_fkey"
            columns: ["empresa_acceso"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sectores: {
        Row: {
          empresa_id: string | null
          id: string
          nombre: string
        }
        Insert: {
          empresa_id?: string | null
          id?: string
          nombre: string
        }
        Update: {
          empresa_id?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipos: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string | null
          id: string
          nombre: string
          numero_serie: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          id?: string
          nombre: string
          numero_serie?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          id?: string
          nombre?: string
          numero_serie?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_certificado: {
        Row: {
          aplica_empresa: boolean | null
          aplica_equipo: boolean | null
          aplica_personal: boolean | null
          aplica_vehiculo: boolean | null
          descripcion: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          aplica_empresa?: boolean | null
          aplica_equipo?: boolean | null
          aplica_personal?: boolean | null
          aplica_vehiculo?: boolean | null
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          aplica_empresa?: boolean | null
          aplica_equipo?: boolean | null
          aplica_personal?: boolean | null
          aplica_vehiculo?: boolean | null
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      vehiculos: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string | null
          id: string
          patente: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          id?: string
          patente: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          id?: string
          patente?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_empresa_acceso: { Args: never; Returns: string }
      app_es_rrhh: { Args: never; Returns: boolean }
      app_es_super_admin: { Args: never; Returns: boolean }
      app_rol: { Args: never; Returns: string }
      app_ve_empresa: { Args: { eid: string }; Returns: boolean }
      app_ve_todas_empresas: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
