import type {
  Couple,
  DebtSettlement,
  EventItem,
  Expense,
  Note,
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
        Insert: Insert<Couple, 'created_at'>
        Update: Update<Couple>
        Relationships: []
      }
      events: {
        Row: EventItem
        Insert: Insert<EventItem, 'id' | 'created_at' | 'updated_at' | 'is_shared'>
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
        Insert: Insert<TaskItem, 'id' | 'created_at' | 'updated_at' | 'status'>
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
