import type { NoteInput } from '../lib/validations/notes'
import { supabase } from '../lib/supabase'

export async function listNotes(coupleId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('couple_id', coupleId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createNote(coupleId: string, userId: string, input: NoteInput) {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      couple_id: coupleId,
      title: input.title,
      content: input.content,
      category: input.category || null,
      is_shared: input.is_shared,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNote(id: string, input: Partial<NoteInput>) {
  const { data, error } = await supabase
    .from('notes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
