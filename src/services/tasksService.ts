import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { TaskInput } from '../lib/validations/tasks'
import { supabase } from '../lib/supabase'
import type { TaskItem } from '../types/app'

export async function listTasks(coupleId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('couple_id', coupleId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

export async function createTask(coupleId: string, userId: string, input: TaskInput) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      couple_id: coupleId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      status: input.status,
      due_date: input.due_date || null,
      assigned_to: input.assigned_to || null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export function subscribeToTasks(
  coupleId: string,
  onChange: (payload: RealtimePostgresChangesPayload<TaskItem>) => void,
) {
  const channel = supabase
    .channel(`tasks:${coupleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `couple_id=eq.${coupleId}` }, onChange)
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
