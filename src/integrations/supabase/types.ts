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
      attendance: {
        Row: {
          id: string
          recording_url: string | null
          reviewed_at: string | null
          session_id: string
          song_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        Insert: {
          id?: string
          recording_url?: string | null
          reviewed_at?: string | null
          session_id: string
          song_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Update: {
          id?: string
          recording_url?: string | null
          reviewed_at?: string | null
          session_id?: string
          song_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          day_of_week: number
          duration_min: number
          id: string
          instrument_id: string
          is_active: boolean
          location_id: string
          max_students: number
          semester_end: string | null
          semester_start: string | null
          start_time: string
          teacher_id: string | null
        }
        Insert: {
          day_of_week: number
          duration_min?: number
          id?: string
          instrument_id: string
          is_active?: boolean
          location_id: string
          max_students?: number
          semester_end?: string | null
          semester_start?: string | null
          start_time: string
          teacher_id?: string | null
        }
        Update: {
          day_of_week?: number
          duration_min?: number
          id?: string
          instrument_id?: string
          is_active?: boolean
          location_id?: string
          max_students?: number
          semester_end?: string | null
          semester_start?: string | null
          start_time?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          batch_id: string
          enrolled_on: string
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Insert: {
          batch_id: string
          enrolled_on?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Update: {
          batch_id?: string
          enrolled_on?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          id: string
          incurred_on: string
          location_id: string | null
          notes: string | null
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          id?: string
          incurred_on?: string
          location_id?: string | null
          notes?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          id?: string
          incurred_on?: string
          location_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      foundation_progress: {
        Row: {
          completed_at: string
          foundation_id: string
          id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          foundation_id: string
          id?: string
          student_id: string
        }
        Update: {
          completed_at?: string
          foundation_id?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          notes: string | null
          paid_on: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_logs: {
        Row: {
          acknowledged_at: string | null
          check_in: Database["public"]["Enums"]["practice_check_in"] | null
          created_at: string
          duration_min: number
          id: string
          played_on: string
          recording_url: string | null
          self_rated_badge: number | null
          shared_with_teacher: boolean
          song_id: string
          student_id: string
          tuning_check_completed: boolean
        }
        Insert: {
          acknowledged_at?: string | null
          check_in?: Database["public"]["Enums"]["practice_check_in"] | null
          created_at?: string
          duration_min?: number
          id?: string
          played_on?: string
          recording_url?: string | null
          self_rated_badge?: number | null
          shared_with_teacher?: boolean
          song_id: string
          student_id: string
          tuning_check_completed?: boolean
        }
        Update: {
          acknowledged_at?: string | null
          check_in?: Database["public"]["Enums"]["practice_check_in"] | null
          created_at?: string
          duration_min?: number
          id?: string
          played_on?: string
          recording_url?: string | null
          self_rated_badge?: number | null
          shared_with_teacher?: boolean
          song_id?: string
          student_id?: string
          tuning_check_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "practice_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          batch_id: string
          completed_at: string | null
          id: string
          scheduled_date: string
          status: Database["public"]["Enums"]["session_status"]
          teacher_notes: string | null
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          id?: string
          scheduled_date: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_notes?: string | null
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          id?: string
          scheduled_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      song_progress: {
        Row: {
          id: string
          last_practiced: string | null
          last_updated: string
          self_badge: number | null
          song_id: string
          student_id: string
          teacher_badge: number | null
        }
        Insert: {
          id?: string
          last_practiced?: string | null
          last_updated?: string
          self_badge?: number | null
          song_id: string
          student_id: string
          teacher_badge?: number | null
        }
        Update: {
          id?: string
          last_practiced?: string | null
          last_updated?: string
          self_badge?: number | null
          song_id?: string
          student_id?: string
          teacher_badge?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "song_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          email: string | null
          fee_amount: number
          fee_cycle: Database["public"]["Enums"]["fee_cycle"]
          fee_start_date: string | null
          id: string
          is_active: boolean
          joined_on: string
          name: string
          parent_name: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          fee_amount?: number
          fee_cycle?: Database["public"]["Enums"]["fee_cycle"]
          fee_start_date?: string | null
          id?: string
          is_active?: boolean
          joined_on?: string
          name: string
          parent_name?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          fee_amount?: number
          fee_cycle?: Database["public"]["Enums"]["fee_cycle"]
          fee_start_date?: string | null
          id?: string
          is_active?: boolean
          joined_on?: string
          name?: string
          parent_name?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      teacher_payouts: {
        Row: {
          adjustment: number
          calculated: number
          created_at: string
          final: number
          hours: number
          id: string
          marked_paid_by: string | null
          month: string
          paid_on: string | null
          sessions: number
          teacher_id: string
        }
        Insert: {
          adjustment?: number
          calculated?: number
          created_at?: string
          final?: number
          hours?: number
          id?: string
          marked_paid_by?: string | null
          month: string
          paid_on?: string | null
          sessions?: number
          teacher_id: string
        }
        Update: {
          adjustment?: number
          calculated?: number
          created_at?: string
          final?: number
          hours?: number
          id?: string
          marked_paid_by?: string | null
          month?: string
          paid_on?: string | null
          sessions?: number
          teacher_id?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          instruments: string[]
          is_active: boolean
          name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          payout_cycle: string
          phone: string | null
          rate: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          instruments?: string[]
          is_active?: boolean
          name: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          payout_cycle?: string
          phone?: string | null
          rate?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          instruments?: string[]
          is_active?: boolean
          name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          payout_cycle?: string
          phone?: string | null
          rate?: number
          user_id?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
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
      weekly_plan_sessions: {
        Row: {
          bonus_completed: boolean
          bonus_instruction: string
          bonus_song_id: string | null
          bonus_target_min: number
          bonus_type: Database["public"]["Enums"]["bonus_type"]
          completed_at: string | null
          created_at: string
          focus_completed: boolean
          focus_instruction: string
          focus_song_id: string
          focus_target_min: number
          generated_at: string
          id: string
          scheduled_date: string
          session_index: number
          session_type: Database["public"]["Enums"]["session_kind"]
          student_id: string
          updated_at: string
          warmup_completed: boolean
          warmup_instruction: string
          warmup_song_id: string | null
          warmup_target_min: number
          week_start: string
        }
        Insert: {
          bonus_completed?: boolean
          bonus_instruction?: string
          bonus_song_id?: string | null
          bonus_target_min?: number
          bonus_type?: Database["public"]["Enums"]["bonus_type"]
          completed_at?: string | null
          created_at?: string
          focus_completed?: boolean
          focus_instruction?: string
          focus_song_id: string
          focus_target_min?: number
          generated_at?: string
          id?: string
          scheduled_date: string
          session_index: number
          session_type?: Database["public"]["Enums"]["session_kind"]
          student_id: string
          updated_at?: string
          warmup_completed?: boolean
          warmup_instruction?: string
          warmup_song_id?: string | null
          warmup_target_min?: number
          week_start: string
        }
        Update: {
          bonus_completed?: boolean
          bonus_instruction?: string
          bonus_song_id?: string | null
          bonus_target_min?: number
          bonus_type?: Database["public"]["Enums"]["bonus_type"]
          completed_at?: string | null
          created_at?: string
          focus_completed?: boolean
          focus_instruction?: string
          focus_song_id?: string
          focus_target_min?: number
          generated_at?: string
          id?: string
          scheduled_date?: string
          session_index?: number
          session_type?: Database["public"]["Enums"]["session_kind"]
          student_id?: string
          updated_at?: string
          warmup_completed?: boolean
          warmup_instruction?: string
          warmup_song_id?: string | null
          warmup_target_min?: number
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_student_in_batch: {
        Args: { _batch_id: string; _user_id: string }
        Returns: boolean
      }
      is_student_in_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_of_batch: {
        Args: { _batch_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_of_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
      attendance_status: "present" | "late" | "absent"
      bonus_type:
        | "callback_song"
        | "mini_challenge"
        | "jam"
        | "foundation_refresh"
      enrollment_status: "active" | "paused" | "dropped"
      expense_category:
        | "rent"
        | "utilities"
        | "equipment"
        | "marketing"
        | "misc"
      fee_cycle: "monthly" | "quarterly" | "semester"
      payment_method: "cash" | "upi" | "card" | "bank"
      payment_status: "paid" | "pending" | "overdue"
      payment_type: "per_hour" | "per_session" | "fixed_monthly"
      practice_check_in: "nailed" | "got_through" | "need_help"
      session_kind: "build" | "flow" | "stretch"
      session_status: "upcoming" | "completed" | "cancelled"
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
      app_role: ["admin", "teacher", "student"],
      attendance_status: ["present", "late", "absent"],
      bonus_type: [
        "callback_song",
        "mini_challenge",
        "jam",
        "foundation_refresh",
      ],
      enrollment_status: ["active", "paused", "dropped"],
      expense_category: ["rent", "utilities", "equipment", "marketing", "misc"],
      fee_cycle: ["monthly", "quarterly", "semester"],
      payment_method: ["cash", "upi", "card", "bank"],
      payment_status: ["paid", "pending", "overdue"],
      payment_type: ["per_hour", "per_session", "fixed_monthly"],
      practice_check_in: ["nailed", "got_through", "need_help"],
      session_kind: ["build", "flow", "stretch"],
      session_status: ["upcoming", "completed", "cancelled"],
    },
  },
} as const
