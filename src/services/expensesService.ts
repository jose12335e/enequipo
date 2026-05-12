import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { ExpenseInput, SettlementInput } from '../lib/validations/expenses'
import { supabase } from '../lib/supabase'
import type { Expense, SplitDetails, SplitType } from '../types/app'

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function splitSharesFor(input: ExpenseInput, userId: string, partnerId: string) {
  const presetPercentages: Partial<Record<ExpenseInput['split_mode'], [number, number]>> = {
    '50_50': [50, 50],
    '60_40': [60, 40],
    '70_30': [70, 30],
    '80_20': [80, 20],
    '100_0': [100, 0],
  }
  const preset = presetPercentages[input.split_mode]

  if (preset) {
    return {
      percentages: {
        [userId]: preset[0],
        [partnerId]: preset[1],
      },
    }
  }

  if (input.split_mode === 'custom_amount') {
    return {
      amounts: {
        [userId]: roundMoney(input.user_amount ?? 0),
        [partnerId]: roundMoney(input.partner_amount ?? 0),
      },
    }
  }

  return {
    percentages: {
      [userId]: roundMoney(input.custom_user_percentage ?? 50),
      [partnerId]: roundMoney(input.custom_partner_percentage ?? 50),
    },
  }
}

function splitPayloadFor(input: ExpenseInput, userId: string, partnerId: string): { split_type: SplitType; split_details: SplitDetails | null } {
  const shares = splitSharesFor(input, userId, partnerId)

  if (shares.percentages?.[userId] === 50 && shares.percentages?.[partnerId] === 50) {
    return { split_type: '50_50', split_details: null }
  }

  if (shares.percentages?.[input.paid_by] === 0) {
    return { split_type: 'one_paid', split_details: null }
  }

  return { split_type: 'custom', split_details: shares }
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
  const splitPayload = splitPayloadFor(input, userId, partnerId)

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      couple_id: coupleId,
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      date: input.date,
      paid_by: input.paid_by,
      split_type: splitPayload.split_type,
      split_details: splitPayload.split_details,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExpense(id: string, userId: string, partnerId: string, input: ExpenseInput) {
  const splitPayload = splitPayloadFor(input, userId, partnerId)

  const { data, error } = await supabase
    .from('expenses')
    .update({
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      date: input.date,
      paid_by: input.paid_by,
      split_type: splitPayload.split_type,
      split_details: splitPayload.split_details,
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
