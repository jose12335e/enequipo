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
  title?: string | null
  amount: number
  currency?: string
  category: string
  category_id?: string | null
  subcategory_id?: string | null
  account_id?: string | null
  description: string | null
  date: string
  paid_by: string
  assigned_to?: string | null
  status?: 'pending' | 'posted' | 'cancelled' | 'refunded' | 'settled'
  split_type: SplitType
  split_details: SplitDetails | null
  is_shared?: boolean
  settled: boolean
  created_by: string
  created_at: string
  updated_at?: string
  deleted_at?: string | null
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
  payment_method?: string | null
  settlement_date?: string
  linked_expense_ids?: string[]
  created_by?: string | null
  note: string | null
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export type FinanceAccountType = 'efectivo' | 'banco' | 'tarjeta_credito' | 'tarjeta_debito' | 'ahorro' | 'prestamo' | 'otro'
export type FinanceTransactionType = 'expense' | 'income' | 'transfer' | 'settlement' | 'saving' | 'refund' | 'debt_payment' | 'adjustment' | 'recurring_expense'
export type FinanceTransactionStatus = 'pending' | 'posted' | 'cancelled' | 'refunded' | 'settled'

export interface FinanceAccount {
  id: string
  couple_id: string
  owner_user_id: string | null
  name: string
  type: FinanceAccountType
  initial_balance: number
  current_balance: number
  currency: string
  color: string | null
  icon: string | null
  is_shared: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FinanceCategory {
  id: string
  couple_id: string
  name: string
  kind: 'expense' | 'income' | 'transfer' | 'saving' | 'debt'
  color: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FinanceSubcategory {
  id: string
  couple_id: string
  category_id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FinanceTransaction {
  id: string
  couple_id: string
  created_by: string | null
  paid_by: string | null
  assigned_to: string | null
  type: FinanceTransactionType
  amount: number
  currency: string
  category_id: string | null
  subcategory_id: string | null
  account_id: string | null
  title: string
  description: string | null
  transaction_date: string
  status: FinanceTransactionStatus
  split_type: SplitType | null
  split_data: SplitDetails | null
  is_shared: boolean
  is_settled: boolean
  source_expense_id: string | null
  source_settlement_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SettlementExpense {
  settlement_id: string
  expense_id: string
  amount_applied: number
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
