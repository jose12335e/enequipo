import { isSameMonth, parseISO } from 'date-fns'
import type { DebtSettlement, Expense, SplitDetails } from '../types/app'

export interface DebtLine {
  fromUser: string
  toUser: string
  amount: number
  expenseId?: string
}

export interface NetBalance {
  balance: number
  debtorId: string | null
  creditorId: string | null
  amount: number
  lines: DebtLine[]
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function shareForUser(amount: number, userId: string, details: SplitDetails | null) {
  if (details?.amounts?.[userId] != null) return Number(details.amounts[userId])
  if (details?.percentages?.[userId] != null) return amount * (Number(details.percentages[userId]) / 100)
  return amount / 2
}

export function calculateUserShare(amount: number, userId: string, details: SplitDetails | null) {
  return roundMoney(shareForUser(amount, userId, details))
}

export function calculateSplit(expense: Expense, userAId: string, userBId: string) {
  const amount = Number(expense.amount)
  if (expense.split_type === 'one_paid') {
    return {
      [userAId]: expense.paid_by === userAId ? 0 : amount,
      [userBId]: expense.paid_by === userBId ? 0 : amount,
    }
  }

  if (expense.split_type === 'custom') {
    return {
      [userAId]: calculateUserShare(amount, userAId, expense.split_details),
      [userBId]: calculateUserShare(amount, userBId, expense.split_details),
    }
  }

  return {
    [userAId]: roundMoney(amount / 2),
    [userBId]: roundMoney(amount / 2),
  }
}

export function expenseDebtLines(expense: Expense, userAId: string, userBId: string): DebtLine[] {
  if (expense.settled) return []

  const amount = Number(expense.amount)
  const users = [userAId, userBId]

  return users
    .filter((userId) => userId !== expense.paid_by)
    .map((userId) => {
      const owed =
        expense.split_type === 'one_paid'
          ? amount
          : expense.split_type === 'custom'
            ? shareForUser(amount, userId, expense.split_details)
            : amount / 2

      return {
        fromUser: userId,
        toUser: expense.paid_by,
        amount: roundMoney(owed),
        expenseId: expense.id,
      }
    })
    .filter((line) => line.amount > 0)
}

export function calculateNetBalance(
  expenses: Expense[],
  userAId: string,
  userBId: string,
  settlements: DebtSettlement[] = [],
): NetBalance {
  const lines = expenses.flatMap((expense) => expenseDebtLines(expense, userAId, userBId))
  let aOwesB = lines
    .filter((line) => line.fromUser === userAId && line.toUser === userBId)
    .reduce((sum, line) => sum + line.amount, 0)
  let bOwesA = lines
    .filter((line) => line.fromUser === userBId && line.toUser === userAId)
    .reduce((sum, line) => sum + line.amount, 0)

  for (const settlement of settlements) {
    if (settlement.from_user === userAId && settlement.to_user === userBId) aOwesB -= Number(settlement.amount)
    if (settlement.from_user === userBId && settlement.to_user === userAId) bOwesA -= Number(settlement.amount)
  }

  const balance = roundMoney(bOwesA - aOwesB)
  if (balance > 0) return { balance, debtorId: userBId, creditorId: userAId, amount: balance, lines }
  if (balance < 0) return { balance, debtorId: userAId, creditorId: userBId, amount: Math.abs(balance), lines }
  return { balance: 0, debtorId: null, creditorId: null, amount: 0, lines }
}

export function calculateCoupleBalance(expenses: Expense[], userAId: string, userBId: string, settlements: DebtSettlement[] = []) {
  return calculateNetBalance(expenses, userAId, userBId, settlements)
}

export function monthlyTotalsByCategory(expenses: Expense[], date = new Date()) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    if (!isSameMonth(parseISO(expense.date), date)) continue
    totals.set(expense.category, roundMoney((totals.get(expense.category) ?? 0) + Number(expense.amount)))
  }
  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export function calculateCategoryTotals(expenses: Expense[], date = new Date()) {
  return monthlyTotalsByCategory(expenses, date)
}

export function calculateMonthlyExpenses(expenses: Expense[], date = new Date()) {
  return expenses
    .filter((expense) => !expense.deleted_at && isSameMonth(parseISO(expense.date), date))
    .reduce((sum, expense) => roundMoney(sum + Number(expense.amount)), 0)
}

export function topMonthlySpender(expenses: Expense[], date = new Date()) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    if (!isSameMonth(parseISO(expense.date), date)) continue
    totals.set(expense.paid_by, roundMoney((totals.get(expense.paid_by) ?? 0) + Number(expense.amount)))
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0] ?? null
}

export function calculateWhoPaidMore(expenses: Expense[], date = new Date()) {
  return topMonthlySpender(expenses, date)
}

export function calculateOpenToSettle(expenses: Expense[], date = new Date()) {
  return expenses
    .filter((expense) => !expense.deleted_at && !expense.settled && isSameMonth(parseISO(expense.date), date))
    .reduce((sum, expense) => roundMoney(sum + Number(expense.amount)), 0)
}

export function calculateAccountBalance(initialBalance: number, transactions: { amount: number; type: string; account_id?: string | null }[], accountId?: string) {
  return transactions
    .filter((transaction) => !accountId || transaction.account_id === accountId)
    .reduce((balance, transaction) => {
      if (transaction.type === 'income' || transaction.type === 'refund') return roundMoney(balance + Number(transaction.amount))
      if (transaction.type === 'transfer') return balance
      return roundMoney(balance - Number(transaction.amount))
    }, roundMoney(initialBalance))
}

export function calculateMonthlyComparison(expenses: Expense[], currentMonth = new Date()) {
  const previousMonth = new Date(currentMonth)
  previousMonth.setMonth(previousMonth.getMonth() - 1)
  const current = calculateMonthlyExpenses(expenses, currentMonth)
  const previous = calculateMonthlyExpenses(expenses, previousMonth)
  const difference = roundMoney(current - previous)
  const percentage = previous > 0 ? roundMoney((difference / previous) * 100) : null
  return { current, previous, difference, percentage }
}
