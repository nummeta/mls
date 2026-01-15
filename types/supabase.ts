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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      choices: {
        Row: {
          answer_text: string
          created_at: string | null
          explanation: string | null
          id: string
          is_correct: boolean | null
          quiz_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          quiz_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choices_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          attempted_at: string | null
          choice_id: string | null
          id: string
          is_correct: boolean | null
          quiz_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          choice_id?: string | null
          id?: string
          is_correct?: boolean | null
          quiz_id: string
          session_id: string
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          choice_id?: string | null
          id?: string
          is_correct?: boolean | null
          quiz_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "choices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_types: {
        Row: {
          created_at: string | null
          id: string
          topic: string
          unit_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          topic: string
          unit_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          topic?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_types_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          id: string
          question: string
          quiz_type_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          question: string
          quiz_type_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          question?: string
          quiz_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_quiz_type_id_fkey"
            columns: ["quiz_type_id"]
            isOneToOne: false
            referencedRelation: "quiz_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          subject_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          end_time: string | null
          id: string
          is_completed: boolean | null
          start_time: string | null
          unit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          is_completed?: boolean | null
          start_time?: string | null
          unit_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          is_completed?: boolean | null
          start_time?: string | null
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      unit_scores: {
        Row: {
          correct_count: number | null
          id: string
          last_updated: string | null
          progress_rate: number | null
          total_quiz_types: number | null
          unit_id: string
          user_id: string
        }
        Insert: {
          correct_count?: number | null
          id?: string
          last_updated?: string | null
          progress_rate?: number | null
          total_quiz_types?: number | null
          unit_id: string
          user_id: string
        }
        Update: {
          correct_count?: number | null
          id?: string
          last_updated?: string | null
          progress_rate?: number | null
          total_quiz_types?: number | null
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_scores_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string | null
          id: string
          intro: string | null
          is_dialogue_checkpoint: boolean | null
          message: string | null
          name: string
          outro: string | null
          section_id: string
          sort_order: number | null
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intro?: string | null
          is_dialogue_checkpoint?: boolean | null
          message?: string | null
          name: string
          outro?: string | null
          section_id: string
          sort_order?: number | null
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intro?: string | null
          is_dialogue_checkpoint?: boolean | null
          message?: string | null
          name?: string
          outro?: string | null
          section_id?: string
          sort_order?: number | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          unit_id: string
          student_id: string
          status: string | null
          dialogue_cleared: boolean | null
          completed_at: string | null
          created_at: string | null
        }
        Insert: {
          unit_id: string
          student_id: string
          status?: string | null
          dialogue_cleared?: boolean | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          unit_id?: string
          student_id?: string
          status?: string | null
          dialogue_cleared?: boolean | null
          completed_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          id: string
          assigned_room_name: string
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          assigned_room_name: string
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          assigned_room_name?: string
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructors_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          id: string
          student_id: string
          instructor_id: string | null
          unit_ids: unknown
          status: string | null
          created_at: string | null
          assigned_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          instructor_id?: string | null
          unit_ids?: unknown
          status?: string | null
          created_at?: string | null
          assigned_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          instructor_id?: string | null
          unit_ids?: unknown
          status?: string | null
          created_at?: string | null
          assigned_at?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          id: string
          student_id: string
          scheduled_start_at: string
          scheduled_end_at: string
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          scheduled_start_at: string
          scheduled_end_at: string
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          scheduled_start_at?: string
          scheduled_end_at?: string
          status?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          id: string
          session_id: string
          order_index: number
          subject: string
          content: string
          planned_minutes: number
          actual_minutes: number | null
          status: string | null
          started_at: string | null
          paused_at: string | null
          accumulated_seconds: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id: string
          order_index: number
          subject: string
          content: string
          planned_minutes: number
          actual_minutes?: number | null
          status?: string | null
          started_at?: string | null
          paused_at?: string | null
          accumulated_seconds?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          order_index?: number
          subject?: string
          content?: string
          planned_minutes?: number
          actual_minutes?: number | null
          status?: string | null
          started_at?: string | null
          paused_at?: string | null
          accumulated_seconds?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      observation_logs: {
        Row: {
          id: string
          session_id: string
          instructor_id: string
          message: string
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id: string
          instructor_id: string
          message: string
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          instructor_id?: string
          message?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_logs_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
