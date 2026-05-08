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

export function monthlyTotalsByCategory(expenses: Expense[], date = new Date()) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    if (!isSameMonth(parseISO(expense.date), date)) continue
    totals.set(expense.category, roundMoney((totals.get(expense.category) ?? 0) + Number(expense.amount)))
  }
  return Array.from(totals.entries()).map(([category, total]) => ({ category, total }))
}

export function topMonthlySpender(expenses: Expense[], date = new Date()) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    if (!isSameMonth(parseISO(expense.date), date)) continue
    totals.set(expense.paid_by, roundMoney((totals.get(expense.paid_by) ?? 0) + Number(expense.amount)))
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0] ?? null
}
