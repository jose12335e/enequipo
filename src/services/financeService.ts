import { supabase } from '../lib/supabase'
import type { FinanceAccount, FinanceAccountType, FinanceCategory, FinanceTransaction } from '../types/app'

const defaultCategories = [
  { name: 'Comida', color: '#fb7185', icon: 'utensils', sort_order: 10 },
  { name: 'Transporte', color: '#60a5fa', icon: 'car', sort_order: 20 },
  { name: 'Casa', color: '#f59e0b', icon: 'home', sort_order: 30 },
  { name: 'Salud', color: '#34d399', icon: 'heart-pulse', sort_order: 40 },
  { name: 'Ocio', color: '#a78bfa', icon: 'sparkles', sort_order: 50 },
  { name: 'Educacion', color: '#38bdf8', icon: 'graduation-cap', sort_order: 60 },
  { name: 'Servicios', color: '#f97316', icon: 'plug', sort_order: 70 },
  { name: 'Regalos', color: '#f472b6', icon: 'gift', sort_order: 80 },
  { name: 'Viajes', color: '#2dd4bf', icon: 'plane', sort_order: 90 },
  { name: 'Deudas', color: '#ef4444', icon: 'receipt', sort_order: 100 },
  { name: 'Ahorro', color: '#22c55e', icon: 'piggy-bank', sort_order: 110 },
  { name: 'Otros', color: '#94a3b8', icon: 'circle-dollar-sign', sort_order: 120 },
]

const defaultSubcategories: Record<string, string[]> = {
  Comida: ['Restaurante', 'Delivery', 'Supermercado'],
  Transporte: ['Uber', 'Gasolina', 'Peaje', 'Parqueo'],
  Casa: ['Renta', 'Mantenimiento', 'Compra del hogar'],
}

export async function listFinanceAccounts(coupleId: string) {
  const { data, error } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createFinanceAccount(input: {
  coupleId: string
  ownerUserId: string
  name: string
  type?: FinanceAccountType
  initialBalance?: number
  color?: string
  icon?: string
}) {
  const initialBalance = input.initialBalance ?? 0
  const { data, error } = await supabase
    .from('finance_accounts')
    .insert({
      couple_id: input.coupleId,
      owner_user_id: input.ownerUserId,
      name: input.name,
      type: input.type ?? 'efectivo',
      initial_balance: initialBalance,
      current_balance: initialBalance,
      currency: 'DOP',
      color: input.color ?? '#ef9fb5',
      icon: input.icon ?? 'wallet',
      is_shared: true,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listFinanceCategories(coupleId: string) {
  const { data, error } = await supabase
    .from('finance_categories')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function listFinanceSubcategories(coupleId: string) {
  const { data, error } = await supabase
    .from('finance_subcategories')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function ensureDefaultFinanceSetup(coupleId: string, userId: string) {
  const [accounts, categories] = await Promise.all([listFinanceAccounts(coupleId), listFinanceCategories(coupleId)])

  let nextAccounts = accounts as FinanceAccount[]
  if (!nextAccounts.length) {
    const account = await createFinanceAccount({
      coupleId,
      ownerUserId: userId,
      name: 'Efectivo compartido',
      type: 'efectivo',
    })
    nextAccounts = [account]
  }

  let nextCategories = categories as FinanceCategory[]
  if (!nextCategories.length) {
    const { data, error } = await supabase
      .from('finance_categories')
      .insert(defaultCategories.map((category) => ({ couple_id: coupleId, kind: 'expense' as const, is_active: true, ...category })))
      .select()
    if (error) throw error
    nextCategories = data

    const subcategoryRows = nextCategories.flatMap((category) =>
      (defaultSubcategories[category.name] ?? []).map((name, index) => ({
        couple_id: coupleId,
        category_id: category.id,
        name,
        sort_order: (index + 1) * 10,
        is_active: true,
      })),
    )

    if (subcategoryRows.length) {
      await supabase.from('finance_subcategories').insert(subcategoryRows)
    }
  }

  const subcategories = await listFinanceSubcategories(coupleId)

  return {
    accounts: nextAccounts,
    categories: nextCategories,
    subcategories,
  }
}

export async function listFinanceTransactions(coupleId: string) {
  const { data, error } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })
  if (error) throw error
  return data as FinanceTransaction[]
}
