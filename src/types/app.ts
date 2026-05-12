export interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  default_event_color?: string | null
  couple_id: string | null
  created_at: string
  updated_at: string
}

export interface Couple {
  id: string
  invite_code: string
  avatar_url: string | null
  created_by: string
  created_at: string
}

export type EventActorType = 'user' | 'couple'
export type EventStatus = 'pending' | 'done' | 'not_done' | 'postponed'

export interface EventItem {
  id: string
  couple_id: string
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  location: string | null
  color: string | null
  is_shared: boolean
  actor_type: EventActorType
  status: EventStatus
  status_note: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  couple_id: string
  title: string
  content: string
  category: string | null
  is_shared: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'not_done' | 'postponed'

export interface TaskItem {
  id: string
  couple_id: string
  title: string
  description: string | null
  priority: TaskPriority | null
  status: TaskStatus
  status_note: string | null
  due_date: string | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type SplitType = '50_50' | 'one_paid' | 'custom'

export interface SplitDetails {
  percentages?: Record<string, number>
  amounts?: Record<string, number>
}

export interface Expense {
  id: string
  couple_id: string
  amount: number
  category: string
  description: string | null
  date: string
  paid_by: string
  split_type: SplitType
  split_details: SplitDetails | null
  settled: boolean
  created_by: string
  created_at: string
}

export interface SavingsGoal {
  id: string
  couple_id: string
  title: string
  target_amount: number
  current_amount: number
  deadline: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface DebtSettlement {
  id: string
  couple_id: string
  amount: number
  from_user: string
  to_user: string
  settled_at: string
  note: string | null
  created_at: string
}

export type ActivityModule = 'calendar' | 'tasks' | 'notes' | 'finances' | 'couple' | 'profile'
export type ActivityAction = 'created' | 'updated' | 'deleted' | 'status_changed' | 'settled' | 'uploaded'

export interface ReleaseNote {
  id: string
  title: string
  summary: string
  highlights: string[]
  published_at: string
  is_active: boolean
}

export interface ReleaseNoteRead {
  release_id: string
  user_id: string
  read_at: string
}

export interface ActivityNotification {
  id: string
  couple_id: string
  actor_id: string
  target_user_id: string
  module: ActivityModule
  action: ActivityAction
  entity_type: string
  entity_id: string | null
  title: string
  body: string | null
  created_at: string
  read_at: string | null
  dismissed_at: string | null
}

export interface AuditLog {
  id: string
  couple_id: string
  actor_id: string | null
  module: string
  action: string
  entity_type: string
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface CoupleContext {
  profile: UserProfile | null
  couple: Couple | null
  partner: UserProfile | null
}
