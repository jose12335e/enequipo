import { addHours, isAfter, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Couple, CoupleContext, UserProfile } from '../types/app'
import { generateInviteCode } from '../utils/invite'

async function membersForCouple(coupleId: string) {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('couple_id', coupleId)
  if (error) throw error
  return data
}

export async function getCoupleContext(userId: string): Promise<CoupleContext> {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile?.couple_id) return { profile: profile ?? null, couple: null, partner: null }

  const [{ data: couple, error: coupleError }, members] = await Promise.all([
    supabase.from('couples').select('*').eq('id', profile.couple_id).maybeSingle(),
    membersForCouple(profile.couple_id),
  ])
  if (coupleError) throw coupleError

  const partner = members.find((member) => member.id !== userId) ?? null
  return { profile, couple, partner }
}

export async function createCouple(userId: string): Promise<Couple> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode()
    const coupleId = crypto.randomUUID()
    const { data, error } = await supabase
      .from('couples')
      .insert({ id: coupleId, invite_code: inviteCode, created_by: userId })
      .select()
      .single()

    if (!error && data) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ couple_id: data.id, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (profileError) throw profileError
      return data
    }

    if (error?.code !== '23505') throw error
  }

  throw new Error('No se pudo generar un código único. Intenta otra vez.')
}

export async function joinCouple(userId: string, inviteCode: string): Promise<UserProfile | null> {
  const code = inviteCode.trim().toUpperCase()
  const { data: couple, error } = await supabase.from('couples').select('*').eq('invite_code', code).maybeSingle()
  if (error) throw error
  if (!couple) throw new Error('Código de invitación inválido o expirado.')

  const expiresAt = addHours(parseISO(couple.created_at), 48)
  if (isAfter(new Date(), expiresAt)) throw new Error('Código de invitación inválido o expirado.')

  const members = await membersForCouple(couple.id)
  if (members.length >= 2) throw new Error('Este código ya fue usado')

  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ couple_id: couple.id, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (profileError) throw profileError

  return members.find((member) => member.id !== userId) ?? null
}

export async function unlinkCouple(coupleId: string) {
  const { error } = await supabase.rpc('unlink_couple', { target_couple_id: coupleId })
  if (error) throw error
}
