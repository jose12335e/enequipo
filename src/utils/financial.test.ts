import { describe, expect, it } from 'vitest'
import type { DebtSettlement, Expense } from '../types/app'
import { calculateNetBalance, monthlyTotalsByCategory, topMonthlySpender } from './financial'

const baseExpense = {
  id: 'expense',
  couple_id: 'couple',
  category: 'Casa',
  description: null,
  date: '2026-05-05',
  split_details: null,
  settled: false,
  created_by: 'a',
  created_at: '2026-05-05T00:00:00Z',
} satisfies Partial<Expense>

describe('financial utils', () => {
  it('calculates 50/50 balance where B owes A when A paid', () => {
    const expenses = [{ ...baseExpense, amount: 100, paid_by: 'a', split_type: '50_50' }] as Expense[]

    const balance = calculateNetBalance(expenses, 'a', 'b')

    expect(balance.balance).toBe(50)
    expect(balance.debtorId).toBe('b')
    expect(balance.creditorId).toBe('a')
    expect(balance.amount).toBe(50)
  })

  it('calculates one_paid as the other person owing the full amount', () => {
    const expenses = [{ ...baseExpense, amount: 75, paid_by: 'b', split_type: 'one_paid' }] as Expense[]

    const balance = calculateNetBalance(expenses, 'a', 'b')

    expect(balance.balance).toBe(-75)
    expect(balance.debtorId).toBe('a')
    expect(balance.creditorId).toBe('b')
  })

  it('supports custom percentages and settlements', () => {
    const expenses = [
      {
        ...baseExpense,
        amount: 200,
        paid_by: 'a',
        split_type: 'custom',
        split_details: { percentages: { a: 25, b: 75 } },
      },
    ] as Expense[]
    const settlements = [
      {
        id: 'settlement',
        couple_id: 'couple',
        amount: 50,
        from_user: 'b',
        to_user: 'a',
        settled_at: '2026-05-06T00:00:00Z',
        note: null,
        created_at: '2026-05-06T00:00:00Z',
      },
    ] as DebtSettlement[]

    const balance = calculateNetBalance(expenses, 'a', 'b', settlements)

    expect(balance.amount).toBe(100)
    expect(balance.debtorId).toBe('b')
  })

  it('supports custom fixed amounts', () => {
    const expenses = [
      {
        ...baseExpense,
        amount: 300,
        paid_by: 'a',
        split_type: 'custom',
        split_details: { amounts: { a: 90, b: 210 } },
      },
    ] as Expense[]

    const balance = calculateNetBalance(expenses, 'a', 'b')

    expect(balance.amount).toBe(210)
    expect(balance.debtorId).toBe('b')
    expect(balance.creditorId).toBe('a')
  })

  it('returns monthly totals and top spender', () => {
    const expenses = [
      { ...baseExpense, id: '1', amount: 20, category: 'Casa', paid_by: 'a', split_type: '50_50' },
      { ...baseExpense, id: '2', amount: 35, category: 'Comida', paid_by: 'b', split_type: '50_50' },
      { ...baseExpense, id: '3', amount: 15, category: 'Casa', paid_by: 'b', split_type: '50_50' },
    ] as Expense[]

    expect(monthlyTotalsByCategory(expenses, new Date('2026-05-08'))).toEqual([
      { category: 'Casa', total: 35 },
      { category: 'Comida', total: 35 },
    ])
    expect(topMonthlySpender(expenses, new Date('2026-05-08'))).toEqual(['b', 50])
  })
})
