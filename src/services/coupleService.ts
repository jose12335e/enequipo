import { supabase } from '../lib/supabase'
import type { Couple, CoupleContext, UserProfile } from '../types/app'
import { generateInviteCode } from '../utils/invite'

async function membersForCouple(coupleId: string) {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('couple_id', coupleId)
  if (error) throw error
  return data as UserProfile[]
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
  void userId
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode()
    const { data, error } = await supabase.rpc('create_couple_for_current_user', {
      new_invite_code: inviteCode,
    })

    if (!error && data) return data as Couple
    if (error?.code !== '23505') throw error
  }

  throw new Error('No se pudo generar un código único. Intenta otra vez.')
}

export async function joinCouple(userId: string, inviteCode: string): Promise<UserProfile | null> {
  void userId
  const { data, error } = await supabase.rpc('join_couple_by_code', {
    raw_invite_code: inviteCode,
  })
  if (error) throw error
  return data as UserProfile | null
}

export async function unlinkCouple(coupleId: string) {
  const { error } = await supabase.rpc('unlink_couple', { target_couple_id: coupleId })
  if (error) throw error
}

export async function updateCoupleAvatar(coupleId: string, avatarUrl: string) {
  const { error } = await supabase
    .from('couples')
    .update({ avatar_url: avatarUrl })
    .eq('id', coupleId)
  if (error) throw error

  const { data, error: fetchError } = await supabase
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!data) throw new Error('No pudimos confirmar la foto de pareja. Revisa las politicas de Supabase.')
  if (data.avatar_url !== avatarUrl) {
    throw new Error('Supabase no permitio guardar la foto de pareja. Revisa la politica UPDATE de couples.')
  }

  return data as Couple
}
