import { supabase } from '../lib/supabase'
import type { ActivityAction, ActivityModule, AuditLog } from '../types/app'

interface AuditInput {
  coupleId: string
  actorId: string
  module: ActivityModule
  action: ActivityAction
  entityType: string
  entityId?: string | null
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}

export async function createAuditLog(input: AuditInput) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      couple_id: input.coupleId,
      actor_id: input.actorId,
      module: input.module,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as AuditLog
}

export async function safeCreateAuditLog(input: AuditInput) {
  try {
    await createAuditLog(input)
  } catch (error) {
    console.warn('DuoLife audit log skipped', error)
  }
}
