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
      app_settings: {
        Row: {
          id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          ai_call_analysis: Json | null
          call_duration: number | null
          call_id: string
          call_result: string | null
          call_status: string | null
          call_tag: string | null
          created_at: string
          from_number: string | null
          lead_score: number | null
          recording_sid: string | null
          recording_url: string | null
          session_id: number | null
          to_number: string | null
          transcription_status: string | null
          transcription_text: string | null
          twilio_call_sid: string | null
          type: string | null
        }
        Insert: {
          ai_analysis_status?: string | null
          ai_call_analysis?: Json | null
          call_duration?: number | null
          call_id?: string
          call_result?: string | null
          call_status?: string | null
          call_tag?: string | null
          created_at?: string
          from_number?: string | null
          lead_score?: number | null
          recording_sid?: string | null
          recording_url?: string | null
          session_id?: number | null
          to_number?: string | null
          transcription_status?: string | null
          transcription_text?: string | null
          twilio_call_sid?: string | null
          type?: string | null
        }
        Update: {
          ai_analysis_status?: string | null
          ai_call_analysis?: Json | null
          call_duration?: number | null
          call_id?: string
          call_result?: string | null
          call_status?: string | null
          call_tag?: string | null
          created_at?: string
          from_number?: string | null
          lead_score?: number | null
          recording_sid?: string | null
          recording_url?: string | null
          session_id?: number | null
          to_number?: string | null
          transcription_status?: string | null
          transcription_text?: string | null
          twilio_call_sid?: string | null
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
          anchoring_detail: string | null
          channel: string | null
          created_at: string
          has_greeting: boolean | null
          has_objection: boolean | null
          has_qualification: boolean | null
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
          objection_categories: string[] | null
          objection_detail: string | null
          objection_overcome: boolean | null
          offer_detail: string | null
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
          used_anchoring: boolean | null
          used_offer: boolean | null
        }
        Insert: {
          ai_tags?: string[] | null
          ai_version?: string | null
          anchoring_detail?: string | null
          channel?: string | null
          created_at?: string
          has_greeting?: boolean | null
          has_objection?: boolean | null
          has_qualification?: boolean | null
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
          objection_categories?: string[] | null
          objection_detail?: string | null
          objection_overcome?: boolean | null
          offer_detail?: string | null
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
          used_anchoring?: boolean | null
          used_offer?: boolean | null
        }
        Update: {
          ai_tags?: string[] | null
          ai_version?: string | null
          anchoring_detail?: string | null
          channel?: string | null
          created_at?: string
          has_greeting?: boolean | null
          has_objection?: boolean | null
          has_qualification?: boolean | null
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
          objection_categories?: string[] | null
          objection_detail?: string | null
          objection_overcome?: boolean | null
          offer_detail?: string | null
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
          used_anchoring?: boolean | null
          used_offer?: boolean | null
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
      seller_goals: {
        Row: {
          active: boolean
          created_at: string
          direction: string
          id: string
          metric: string
          seller_id: string | null
          target: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          direction?: string
          id?: string
          metric: string
          seller_id?: string | null
          target: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          direction?: string
          id?: string
          metric?: string
          seller_id?: string | null
          target?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      get_conversion_by_quote_bracket: {
        Args: { period_days?: number }
        Returns: {
          avg_quote_value: number
          conversion_rate: number
          converted_leads: number
          quote_bracket: string
          total_leads: number
        }[]
      }
      get_conversion_by_response_time: {
        Args: { period_days?: number }
        Returns: {
          conversion_rate: number
          converted_leads: number
          time_bracket: string
          total_leads: number
        }[]
      }
      get_interaction_counts: {
        Args: never
        Returns: {
          message_count: number
          session_id: number
        }[]
      }
      get_leads_kpis: { Args: { period_days?: number }; Returns: Json }
      get_sellers_kpis: { Args: { period_days?: number }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
