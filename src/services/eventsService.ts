import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { EventInput } from '../lib/validations/events'
import { supabase } from '../lib/supabase'
import type { EventItem, EventStatus } from '../types/app'

export async function listEvents(coupleId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('couple_id', coupleId)
    .order('start_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createEvent(coupleId: string, userId: string, input: EventInput) {
  const { data, error } = await supabase
    .from('events')
    .insert({
      couple_id: coupleId,
      title: input.title,
      description: input.description || null,
      start_at: new Date(input.start_at).toISOString(),
      end_at: input.end_at ? new Date(input.end_at).toISOString() : null,
      location: input.location || null,
      color: input.color || '#ef9fb5',
      is_shared: input.is_shared,
      actor_type: input.actor_type ?? 'user',
      status: 'pending',
      status_note: null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEventStatus(id: string, status: EventStatus, statusNote?: string | null) {
  const { data, error } = await supabase
    .from('events')
    .update({
      status,
      status_note: status === 'not_done' || status === 'postponed' ? statusNote : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as EventItem
}

export async function updateEvent(id: string, input: Partial<EventInput>) {
  const values = {
    ...input,
    start_at: input.start_at ? new Date(input.start_at).toISOString() : undefined,
    end_at: input.end_at ? new Date(input.end_at).toISOString() : undefined,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('events').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

export function subscribeToEvents(
  coupleId: string,
  onChange: (payload: RealtimePostgresChangesPayload<EventItem>) => void,
) {
  const channel = supabase
    .channel(`events:${coupleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${coupleId}` }, onChange)
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
