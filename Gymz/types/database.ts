export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type GenericTable = {
  Row: Json
  Insert: Json
  Update: Json
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      users: GenericTable
      attendance: GenericTable
      calories: GenericTable
      achievements: GenericTable
      classes: GenericTable
      bookings: GenericTable
      recommendations: GenericTable
      payments: GenericTable
      staff: GenericTable
      notifications: GenericTable
      notice_board: GenericTable
      conversations: GenericTable
      gym_classes: GenericTable
      gym_schedules: GenericTable
      gym_events: GenericTable
      gym_class_bookings: GenericTable
      ai_settings: GenericTable
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

