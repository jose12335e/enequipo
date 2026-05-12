import type {
  Couple,
  ActivityNotification,
  AuditLog,
  DebtSettlement,
  EventItem,
  Expense,
  Note,
  ReleaseNote,
  ReleaseNoteRead,
  SavingsGoal,
  TaskItem,
  UserProfile,
} from './app'

type Insert<T, Defaults extends keyof T = never> = Omit<T, Defaults> & Partial<Pick<T, Defaults>>
type Update<T> = Partial<T>

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile
        Insert: Insert<UserProfile, 'created_at' | 'updated_at'>
        Update: Update<UserProfile>
        Relationships: []
      }
      couples: {
        Row: Couple
        Insert: Insert<Couple, 'id' | 'created_at' | 'avatar_url'>
        Update: Update<Couple>
        Relationships: []
      }
      events: {
        Row: EventItem
        Insert: Insert<EventItem, 'id' | 'created_at' | 'updated_at' | 'is_shared' | 'actor_type' | 'status' | 'status_note'>
        Update: Update<EventItem>
        Relationships: []
      }
      notes: {
        Row: Note
        Insert: Insert<Note, 'id' | 'created_at' | 'updated_at' | 'is_shared'>
        Update: Update<Note>
        Relationships: []
      }
      tasks: {
        Row: TaskItem
        Insert: Insert<TaskItem, 'id' | 'created_at' | 'updated_at' | 'status' | 'status_note'>
        Update: Update<TaskItem>
        Relationships: []
      }
      expenses: {
        Row: Expense
        Insert: Insert<Expense, 'id' | 'created_at' | 'settled'>
        Update: Update<Expense>
        Relationships: []
      }
      savings_goals: {
        Row: SavingsGoal
        Insert: Insert<SavingsGoal, 'id' | 'created_at' | 'updated_at' | 'current_amount'>
        Update: Update<SavingsGoal>
        Relationships: []
      }
      debt_settlements: {
        Row: DebtSettlement
        Insert: Insert<DebtSettlement, 'id' | 'created_at'>
        Update: Update<DebtSettlement>
        Relationships: []
      }
      release_notes: {
        Row: ReleaseNote
        Insert: Insert<ReleaseNote, 'published_at' | 'is_active'>
        Update: Update<ReleaseNote>
        Relationships: []
      }
      release_note_reads: {
        Row: ReleaseNoteRead
        Insert: Insert<ReleaseNoteRead, 'read_at'>
        Update: Update<ReleaseNoteRead>
        Relationships: []
      }
      activity_notifications: {
        Row: ActivityNotification
        Insert: Insert<ActivityNotification, 'id' | 'created_at' | 'read_at' | 'dismissed_at'>
        Update: Update<ActivityNotification>
        Relationships: []
      }
      audit_logs: {
        Row: AuditLog
        Insert: Insert<AuditLog, 'id' | 'created_at' | 'actor_id' | 'old_data' | 'new_data'>
        Update: Update<AuditLog>
        Relationships: []
      }
    }
    Views: {
      couple_members: {
        Row: {
          couple_id: string
          user_id: string
        }
        Relationships: []
      }
    }
    Functions: {
      unlink_couple: {
        Args: {
          target_couple_id: string
        }
        Returns: void
      }
      create_couple_for_current_user: {
        Args: {
          new_invite_code: string
        }
        Returns: Couple
      }
      join_couple_by_code: {
        Args: {
          raw_invite_code: string
        }
        Returns: UserProfile
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
