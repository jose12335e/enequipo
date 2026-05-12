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
    .is('deleted_at', null)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function listSettlements(coupleId: string) {
  const { data, error } = await supabase
    .from('debt_settlements')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('settled_at', { ascending: false })
  if (error) throw error
  return data
}

async function upsertExpenseTransaction(expense: Expense) {
  const { error } = await supabase
    .from('finance_transactions')
    .upsert(
      {
        couple_id: expense.couple_id,
        created_by: expense.created_by,
        paid_by: expense.paid_by,
        assigned_to: expense.assigned_to ?? null,
        type: 'expense',
        amount: expense.amount,
        currency: expense.currency ?? 'DOP',
        category_id: expense.category_id ?? null,
        subcategory_id: expense.subcategory_id ?? null,
        account_id: expense.account_id ?? null,
        title: expense.title ?? expense.category,
        description: expense.description,
        transaction_date: expense.date,
        status: expense.status ?? 'posted',
        split_type: expense.split_type,
        split_data: expense.split_details,
        is_shared: expense.is_shared ?? true,
        is_settled: expense.settled,
        source_expense_id: expense.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_expense_id' },
    )
  if (error) throw error
}

async function upsertSettlementTransaction(settlement: {
  id: string
  couple_id: string
  created_by?: string | null
  from_user: string
  to_user: string
  amount: number
  note: string | null
  settlement_date?: string
  settled_at: string
  created_at: string
}) {
  const { error } = await supabase
    .from('finance_transactions')
    .upsert(
      {
        couple_id: settlement.couple_id,
        created_by: settlement.created_by ?? null,
        paid_by: settlement.from_user,
        assigned_to: settlement.to_user,
        type: 'settlement',
        amount: settlement.amount,
        currency: 'DOP',
        title: 'Liquidacion de deuda',
        description: settlement.note,
        transaction_date: settlement.settlement_date ?? settlement.settled_at.slice(0, 10),
        status: 'settled',
        is_shared: true,
        is_settled: true,
        source_settlement_id: settlement.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_settlement_id' },
    )
  if (error) throw error
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
      title: input.description || input.category,
      currency: 'DOP',
      category: input.category,
      category_id: input.category_id || null,
      subcategory_id: input.subcategory_id || null,
      account_id: input.account_id,
      description: input.description || null,
      date: input.date,
      paid_by: input.paid_by,
      split_type: splitPayload.split_type,
      split_details: splitPayload.split_details,
      status: 'posted',
      is_shared: true,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  await upsertExpenseTransaction(data)
  return data
}

export async function updateExpense(id: string, userId: string, partnerId: string, input: ExpenseInput) {
  const splitPayload = splitPayloadFor(input, userId, partnerId)

  const { data, error } = await supabase
    .from('expenses')
    .update({
      amount: input.amount,
      title: input.description || input.category,
      currency: 'DOP',
      category: input.category,
      category_id: input.category_id || null,
      subcategory_id: input.subcategory_id || null,
      account_id: input.account_id,
      description: input.description || null,
      date: input.date,
      paid_by: input.paid_by,
      split_type: splitPayload.split_type,
      split_details: splitPayload.split_details,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await upsertExpenseTransaction(data)
  return data
}

export async function updateSettlement(id: string, input: SettlementInput) {
  const { data, error } = await supabase
    .from('debt_settlements')
    .update({
      amount: input.amount,
      from_user: input.from_user,
      to_user: input.to_user,
      payment_method: input.payment_method || null,
      settlement_date: input.settlement_date,
      linked_expense_ids: input.linked_expense_ids,
      note: input.note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  const { error: deleteLinksError } = await supabase.from('settlement_expenses').delete().eq('settlement_id', id)
  if (deleteLinksError) throw deleteLinksError
  const { error: linksError } = await supabase.from('settlement_expenses').insert(
    input.linked_expense_ids.map((expenseId) => ({
      settlement_id: id,
      expense_id: expenseId,
      amount_applied: 0,
    })),
  )
  if (linksError) throw linksError
  await upsertSettlementTransaction(data)
  return data
}

export async function deleteExpense(id: string) {
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  await supabase
    .from('finance_transactions')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('source_expense_id', id)
}

export async function createSettlement(coupleId: string, userId: string, input: SettlementInput) {
  const { data, error } = await supabase
    .from('debt_settlements')
    .insert({
      couple_id: coupleId,
      amount: input.amount,
      from_user: input.from_user,
      to_user: input.to_user,
      payment_method: input.payment_method || null,
      settlement_date: input.settlement_date,
      linked_expense_ids: input.linked_expense_ids,
      created_by: userId,
      settled_at: new Date(`${input.settlement_date}T12:00:00`).toISOString(),
      note: input.note || null,
    })
    .select()
    .single()
  if (error) throw error

  const { error: linksError } = await supabase.from('settlement_expenses').insert(
    input.linked_expense_ids.map((expenseId) => ({
      settlement_id: data.id,
      expense_id: expenseId,
      amount_applied: 0,
    })),
  )
  if (linksError) throw linksError

  const { error: settleError } = await supabase
    .from('expenses')
    .update({ settled: true, status: 'settled', updated_at: new Date().toISOString() })
    .eq('couple_id', coupleId)
    .in('id', input.linked_expense_ids)
  if (settleError) throw settleError

  const { error: transactionUpdateError } = await supabase
    .from('finance_transactions')
    .update({ is_settled: true, status: 'settled', updated_at: new Date().toISOString() })
    .in('source_expense_id', input.linked_expense_ids)
  if (transactionUpdateError) throw transactionUpdateError

  await upsertSettlementTransaction(data)

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
