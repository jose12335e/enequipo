import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFinanceAccount, ensureDefaultFinanceSetup, listFinanceAccounts, listFinanceCategories, listFinanceSubcategories } from '../services/financeService'
import { listExpenses, listSettlements, subscribeToExpenses } from '../services/expensesService'
import type { DebtSettlement, Expense, FinanceAccount, FinanceCategory, FinanceSubcategory } from '../types/app'
import {
  calculateCategoryTotals,
  calculateCoupleBalance,
  calculateMonthlyExpenses,
  calculateOpenToSettle,
  calculateWhoPaidMore,
} from '../utils/financial'

export function useCoupleFinance(coupleId: string | null | undefined, userId: string | null | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<DebtSettlement[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [subcategories, setSubcategories] = useState<FinanceSubcategory[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!coupleId || !userId) return
    let setup: { accounts: FinanceAccount[]; categories: FinanceCategory[]; subcategories: FinanceSubcategory[] } = {
      accounts: [],
      categories: [],
      subcategories: [],
    }
    try {
      setup = await ensureDefaultFinanceSetup(coupleId, userId)
    } catch (error) {
      console.error('Finance metadata is not ready. Run the finance phase 1 migration in Supabase.', error)
    }
    const [expenseRows, settlementRows] = await Promise.all([listExpenses(coupleId), listSettlements(coupleId)])
    setAccounts(setup.accounts)
    setCategories(setup.categories)
    setSubcategories(setup.subcategories)
    setExpenses(expenseRows)
    setSettlements(settlementRows)
  }, [coupleId, userId])

  useEffect(() => {
    if (!coupleId || !userId) return
    void Promise.resolve().then(refresh).catch(console.error).finally(() => setLoading(false))
    return subscribeToExpenses(coupleId, () => {
      void refresh()
    })
  }, [coupleId, refresh, userId])

  const createDefaultAccount = useCallback(async () => {
    if (!coupleId || !userId) return null
    const account = await createFinanceAccount({
      coupleId,
      ownerUserId: userId,
      name: 'Efectivo compartido',
      type: 'efectivo',
    })
    setAccounts((current) => [...current, account])
    return account
  }, [coupleId, userId])

  return {
    expenses,
    settlements,
    accounts,
    categories,
    subcategories,
    loading,
    refresh,
    createDefaultAccount,
  }
}

export function useMonthlyFinance(expenses: Expense[], settlements: DebtSettlement[], month: Date) {
  return useMemo(
    () => ({
      expenses: expenses.filter((expense) => {
        const expenseMonth = new Date(`${expense.date}T12:00:00`)
        return expenseMonth.getMonth() === month.getMonth() && expenseMonth.getFullYear() === month.getFullYear()
      }),
      settlements: settlements.filter((settlement) => {
        const value = settlement.settlement_date ?? settlement.settled_at?.slice(0, 10)
        const settlementMonth = new Date(`${value}T12:00:00`)
        return settlementMonth.getMonth() === month.getMonth() && settlementMonth.getFullYear() === month.getFullYear()
      }),
    }),
    [expenses, month, settlements],
  )
}

export function useFinanceSummary(expenses: Expense[], settlements: DebtSettlement[], month: Date, userId: string | null | undefined, partnerId: string | null | undefined) {
  return useMemo(() => {
    const balance = userId && partnerId ? calculateCoupleBalance(expenses, userId, partnerId, settlements) : null
    return {
      balance,
      monthlyExpenses: calculateMonthlyExpenses(expenses, month),
      categoryTotals: calculateCategoryTotals(expenses, month),
      whoPaidMore: calculateWhoPaidMore(expenses, month),
      openToSettle: calculateOpenToSettle(expenses, month),
    }
  }, [expenses, month, partnerId, settlements, userId])
}

export function useFinance(coupleId: string | null | undefined, userId: string | null | undefined) {
  return useCoupleFinance(coupleId, userId)
}

export async function refreshFinanceMetadata(coupleId: string) {
  const [accounts, categories, subcategories] = await Promise.all([
    listFinanceAccounts(coupleId),
    listFinanceCategories(coupleId),
    listFinanceSubcategories(coupleId),
  ])
  return { accounts, categories, subcategories }
}
