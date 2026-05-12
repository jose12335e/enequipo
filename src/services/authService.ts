import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types/app'

export async function ensureProfile(userId: string, fullName?: string | null, email?: string | null) {
  const existing = await getProfile(userId)
  if (existing) return existing

  const fallbackName = fullName || email?.split('@')[0] || 'Usuario DuoLife'
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      id: userId,
      full_name: fallbackName,
      avatar_url: null,
      couple_id: null,
    })
    .select()
    .single()
  if (error) throw error
  return data as UserProfile
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (data.user) {
    await ensureProfile(data.user.id, data.user.user_metadata?.full_name, data.user.email)
  }
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  if (!data.user) throw new Error('No se pudo crear el usuario')
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function updateProfile(userId: string, values: Pick<UserProfile, 'full_name' | 'avatar_url'> & Partial<Pick<UserProfile, 'default_event_color'>>) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
