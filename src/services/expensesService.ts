import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { ExpenseInput, SettlementInput } from '../lib/validations/expenses'
import { supabase } from '../lib/supabase'
import type { Expense, SplitDetails } from '../types/app'

function splitDetailsFor(input: ExpenseInput, userId: string, partnerId: string): SplitDetails | null {
  return input.split_type === 'custom' && input.partner_percentage != null
    ? {
        percentages: {
          [partnerId]: input.partner_percentage,
          [userId]: 100 - input.partner_percentage,
        },
      }
    : null
}

export async function listExpenses(coupleId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('couple_id', coupleId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function listSettlements(coupleId: string) {
  const { data, error } = await supabase
    .from('debt_settlements')
    .select('*')
    .eq('couple_id', coupleId)
    .order('settled_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createExpense(
  coupleId: string,
  userId: string,
  partnerId: string,
  input: ExpenseInput,
) {
  const splitDetails = splitDetailsFor(input, userId, partnerId)

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      couple_id: coupleId,
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      date: input.date,
      paid_by: input.paid_by,
      split_type: input.split_type,
      split_details: splitDetails,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExpense(id: string, userId: string, partnerId: string, input: ExpenseInput) {
  const { data, error } = await supabase
    .from('expenses')
    .update({
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      date: input.date,
      paid_by: input.paid_by,
      split_type: input.split_type,
      split_details: splitDetailsFor(input, userId, partnerId),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSettlement(id: string, input: SettlementInput) {
  const { data, error } = await supabase
    .from('debt_settlements')
    .update({
      amount: input.amount,
      from_user: input.from_user,
      to_user: input.to_user,
      note: input.note || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export async function createSettlement(coupleId: string, input: SettlementInput) {
  const { data, error } = await supabase
    .from('debt_settlements')
    .insert({
      couple_id: coupleId,
      amount: input.amount,
      from_user: input.from_user,
      to_user: input.to_user,
      settled_at: new Date().toISOString(),
      note: input.note || null,
    })
    .select()
    .single()
  if (error) throw error

  const { error: settleError } = await supabase
    .from('expenses')
    .update({ settled: true })
    .eq('couple_id', coupleId)
    .eq('settled', false)
  if (settleError) throw settleError

  return data
}

export function subscribeToExpenses(
  coupleId: string,
  onChange: (payload: RealtimePostgresChangesPayload<Expense>) => void,
) {
  const channel = supabase
    .channel(`expenses:${coupleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `couple_id=eq.${coupleId}` }, onChange)
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
