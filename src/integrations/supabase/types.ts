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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_details: Json | null
          event_type: string
          execution_time_ms: number | null
          function_name: string | null
          id: string
          session_id: number | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_details?: Json | null
          event_type: string
          execution_time_ms?: number | null
          function_name?: string | null
          id?: string
          session_id?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_details?: Json | null
          event_type?: string
          execution_time_ms?: number | null
          function_name?: string | null
          id?: string
          session_id?: number | null
          status?: string
        }
        Relationships: []
      }
      call_db: {
        Row: {
          ai_analysis_status: string | null
          call_duration: number | null
          call_id: string
          call_result: string | null
          call_tag: string | null
          created_at: string
          lead_score: number | null
          session_id: number | null
          type: string | null
        }
        Insert: {
          ai_analysis_status?: string | null
          call_duration?: number | null
          call_id?: string
          call_result?: string | null
          call_tag?: string | null
          created_at?: string
          lead_score?: number | null
          session_id?: number | null
          type?: string | null
        }
        Update: {
          ai_analysis_status?: string | null
          call_duration?: number | null
          call_id?: string
          call_result?: string | null
          call_tag?: string | null
          created_at?: string
          lead_score?: number | null
          session_id?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_db_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lead_db"
            referencedColumns: ["session_id"]
          },
        ]
      }
      interaction_db: {
        Row: {
          channel: string | null
          interaction_id: string
          message_text: string | null
          sender_type: string | null
          session_id: number | null
          timestamp: string
        }
        Insert: {
          channel?: string | null
          interaction_id?: string
          message_text?: string | null
          sender_type?: string | null
          session_id?: number | null
          timestamp?: string
        }
        Update: {
          channel?: string | null
          interaction_id?: string
          message_text?: string | null
          sender_type?: string | null
          session_id?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_db_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lead_db"
            referencedColumns: ["session_id"]
          },
        ]
      }
      lead_db: {
        Row: {
          ai_tags: string[] | null
          ai_version: string | null
          channel: string | null
          created_at: string
          has_objection: boolean | null
          improvement_point: string | null
          is_walking: boolean | null
          last_ai_update: string | null
          last_updated: string | null
          lead_intent: string | null
          lead_language: string | null
          lead_price: number | null
          lead_score: number | null
          lead_temperature: string | null
          need_summary: string | null
          objection_detail: string | null
          playbook_compliance_score: number | null
          playbook_steps_completed: string[] | null
          playbook_steps_missing: string[] | null
          playbook_violations: string | null
          processed: boolean | null
          sales_person_id: string | null
          sales_status: string | null
          sentiment: string | null
          service_desired: string | null
          service_rating: number | null
          session_id: number
          upsell_opportunity: string | null
        }
        Insert: {
          ai_tags?: string[] | null
          ai_version?: string | null
          channel?: string | null
          created_at?: string
          has_objection?: boolean | null
          improvement_point?: string | null
          is_walking?: boolean | null
          last_ai_update?: string | null
          last_updated?: string | null
          lead_intent?: string | null
          lead_language?: string | null
          lead_price?: number | null
          lead_score?: number | null
          lead_temperature?: string | null
          need_summary?: string | null
          objection_detail?: string | null
          playbook_compliance_score?: number | null
          playbook_steps_completed?: string[] | null
          playbook_steps_missing?: string[] | null
          playbook_violations?: string | null
          processed?: boolean | null
          sales_person_id?: string | null
          sales_status?: string | null
          sentiment?: string | null
          service_desired?: string | null
          service_rating?: number | null
          session_id: number
          upsell_opportunity?: string | null
        }
        Update: {
          ai_tags?: string[] | null
          ai_version?: string | null
          channel?: string | null
          created_at?: string
          has_objection?: boolean | null
          improvement_point?: string | null
          is_walking?: boolean | null
          last_ai_update?: string | null
          last_updated?: string | null
          lead_intent?: string | null
          lead_language?: string | null
          lead_price?: number | null
          lead_score?: number | null
          lead_temperature?: string | null
          need_summary?: string | null
          objection_detail?: string | null
          playbook_compliance_score?: number | null
          playbook_steps_completed?: string[] | null
          playbook_steps_missing?: string[] | null
          playbook_violations?: string | null
          processed?: boolean | null
          sales_person_id?: string | null
          sales_status?: string | null
          sentiment?: string | null
          service_desired?: string | null
          service_rating?: number | null
          session_id?: number
          upsell_opportunity?: string | null
        }
        Relationships: []
      }
      lead_history: {
        Row: {
          change_source: string | null
          changed_by: string | null
          created_at: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          session_id: number
        }
        Insert: {
          change_source?: string | null
          changed_by?: string | null
          created_at?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          session_id: number
        }
        Update: {
          change_source?: string | null
          changed_by?: string | null
          created_at?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          session_id?: number
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          product_type: string
          steps: Json | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_type: string
          steps?: Json | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_type?: string
          steps?: Json | null
          title?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string | null
          id: string
          product_name: string
          product_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_name: string
          product_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_name?: string
          product_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      interaction_counts: {
        Row: {
          message_count: number | null
          session_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_db_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lead_db"
            referencedColumns: ["session_id"]
          },
        ]
      }
    }
    Functions: {
      get_interaction_counts: {
        Args: never
        Returns: {
          message_count: number
          session_id: number
        }[]
      }
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
