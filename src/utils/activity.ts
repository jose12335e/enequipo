import type { EventItem, Expense, Note, TaskItem, UserProfile } from '../types/app'

export type ActivityModule = 'calendar' | 'tasks' | 'notes' | 'finances'

export interface ActivityItem {
  id: string
  module: ActivityModule
  title: string
  description: string
  createdBy: string | null
  createdAt: string
}

const activityRoutes: Record<ActivityModule, string> = {
  calendar: '/app/calendar',
  tasks: '/app/tasks',
  notes: '/app/notes',
  finances: '/app/finances',
}

function seenKey(userId: string) {
  return `doulife:seen-activity:${userId}`
}

function preferenceKey(userId: string) {
  return `doulife:preferences:${userId}`
}

export function activityRoute(module: ActivityModule) {
  return activityRoutes[module]
}

export function readSeenActivity(userId: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(seenKey(userId)) ?? '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

export function markActivitySeen(userId: string, items: Pick<ActivityItem, 'id' | 'module'>[]) {
  const seen = readSeenActivity(userId)
  for (const item of items) seen.add(`${item.module}:${item.id}`)
  localStorage.setItem(seenKey(userId), JSON.stringify([...seen]))
}

export function isActivitySeen(userId: string, item: Pick<ActivityItem, 'id' | 'module'>) {
  return readSeenActivity(userId).has(`${item.module}:${item.id}`)
}

export function eventActivity(event: EventItem): ActivityItem {
  return {
    id: event.id,
    module: 'calendar',
    title: event.title,
    description: event.actor_type === 'couple' ? 'Agregaron un evento como pareja.' : 'Agrego un evento al calendario.',
    createdBy: event.created_by,
    createdAt: event.created_at,
  }
}

export function taskActivity(task: TaskItem): ActivityItem {
  return {
    id: task.id,
    module: 'tasks',
    title: task.title,
    description: task.assigned_to ? 'Agrego una tarea.' : 'Agrego una tarea para ambos.',
    createdBy: task.created_by,
    createdAt: task.created_at,
  }
}

export function noteActivity(note: Note): ActivityItem {
  return {
    id: note.id,
    module: 'notes',
    title: note.title,
    description: 'Agrego una nota.',
    createdBy: note.created_by,
    createdAt: note.created_at,
  }
}

export function expenseActivity(expense: Expense): ActivityItem {
  return {
    id: expense.id,
    module: 'finances',
    title: expense.category,
    description: 'Registro un gasto.',
    createdBy: expense.created_by,
    createdAt: expense.created_at,
  }
}

export function partnerUnseenActivity(userId: string, partner: UserProfile | null, items: ActivityItem[]) {
  if (!partner) return []

  return items
    .filter((item) => item.createdBy === partner.id && !isActivitySeen(userId, item))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function markModuleActivitySeen(userId: string, module: ActivityModule, items: ActivityItem[]) {
  markActivitySeen(
    userId,
    items.filter((item) => item.module === module),
  )
}

export function getDefaultEventColor(profile?: Pick<UserProfile, 'id' | 'default_event_color'> | null) {
  if (!profile) return '#ef9fb5'
  if (profile.default_event_color) return profile.default_event_color

  try {
    const preferences = JSON.parse(localStorage.getItem(preferenceKey(profile.id)) ?? '{}') as { default_event_color?: string }
    return preferences.default_event_color || '#ef9fb5'
  } catch {
    return '#ef9fb5'
  }
}

export function saveDefaultEventColor(userId: string, color: string) {
  try {
    const preferences = JSON.parse(localStorage.getItem(preferenceKey(userId)) ?? '{}') as Record<string, string>
    localStorage.setItem(preferenceKey(userId), JSON.stringify({ ...preferences, default_event_color: color }))
  } catch {
    localStorage.setItem(preferenceKey(userId), JSON.stringify({ default_event_color: color }))
  }
}
