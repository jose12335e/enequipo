import { supabase } from '../lib/supabase'
import type { ActivityAction, ActivityModule, ActivityNotification } from '../types/app'
import { safeCreateAuditLog } from './auditService'

export const activityRoutes: Record<ActivityModule, string> = {
  calendar: '/app/calendar',
  tasks: '/app/tasks',
  notes: '/app/notes',
  finances: '/app/finances',
  couple: '/app/couple',
  profile: '/app/profile',
}

interface ActivityInput {
  coupleId: string
  actorId: string
  targetUserId?: string | null
  module: ActivityModule
  action: ActivityAction
  entityType: string
  entityId?: string | null
  title: string
  body?: string | null
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}

export function activityRoute(module: ActivityModule) {
  return activityRoutes[module]
}

export async function listUnreadActivityNotifications() {
  const { data, error } = await supabase
    .from('activity_notifications')
    .select('*')
    .is('read_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ActivityNotification[]
}

export async function createActivityNotification(input: Omit<ActivityInput, 'targetUserId'> & { targetUserId: string }) {
  const { data, error } = await supabase
    .from('activity_notifications')
    .insert({
      couple_id: input.coupleId,
      actor_id: input.actorId,
      target_user_id: input.targetUserId,
      module: input.module,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      title: input.title,
      body: input.body ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as ActivityNotification
}

export async function markActivityNotificationRead(id: string) {
  const { data, error } = await supabase
    .from('activity_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ActivityNotification
}

export async function markActivityNotificationsRead(notifications: Pick<ActivityNotification, 'id'>[]) {
  if (!notifications.length) return
  const { error } = await supabase
    .from('activity_notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', notifications.map((notification) => notification.id))

  if (error) throw error
}

export async function dismissActivityNotification(id: string) {
  const { data, error } = await supabase
    .from('activity_notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ActivityNotification
}

export async function recordPartnerActivity(input: ActivityInput) {
  await safeCreateAuditLog(input)

  if (!input.targetUserId || input.targetUserId === input.actorId) return

  try {
    await createActivityNotification({
      ...input,
      targetUserId: input.targetUserId,
    })
  } catch (error) {
    console.warn('DuoLife activity notification skipped', error)
  }
}
