import { supabase } from '../lib/supabase'
import type { ReleaseNote } from '../types/app'

function normalizeReleaseNote(note: ReleaseNote): ReleaseNote {
  return {
    ...note,
    highlights: Array.isArray(note.highlights) ? note.highlights.map(String) : [],
  }
}

export async function listUnreadReleaseNotes(userId: string) {
  const { data: reads, error: readsError } = await supabase
    .from('release_note_reads')
    .select('release_id')
    .eq('user_id', userId)

  if (readsError) throw readsError

  const readIds = new Set((reads ?? []).map((read) => read.release_id))
  const { data, error } = await supabase
    .from('release_notes')
    .select('*')
    .eq('is_active', true)
    .order('published_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((note) => normalizeReleaseNote(note as ReleaseNote)).filter((note) => !readIds.has(note.id))
}

export async function markReleaseRead(userId: string, releaseId: string) {
  const { error } = await supabase
    .from('release_note_reads')
    .upsert({ user_id: userId, release_id: releaseId, read_at: new Date().toISOString() }, { onConflict: 'release_id,user_id' })

  if (error) throw error
}

export async function markReleaseNotesRead(userId: string, releases: Pick<ReleaseNote, 'id'>[]) {
  if (!releases.length) return
  const readAt = new Date().toISOString()
  const { error } = await supabase.from('release_note_reads').upsert(
    releases.map((release) => ({
      user_id: userId,
      release_id: release.id,
      read_at: readAt,
    })),
    { onConflict: 'release_id,user_id' },
  )

  if (error) throw error
}
