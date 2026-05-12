import { zodResolver } from '@hookform/resolvers/zod'
import { CircleDollarSign, HandCoins, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Select } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { expenseSchema, settlementSchema, type ExpenseInput, type SettlementInput } from '../lib/validations/expenses'
import { createExpense, createSettlement, deleteExpense, listExpenses, listSettlements, subscribeToExpenses, updateExpense, updateSettlement } from '../services/expensesService'
import { useToastStore } from '../store/toastStore'
import type { DebtSettlement, Expense, UserProfile } from '../types/app'
import { calculateNetBalance, monthlyTotalsByCategory, topMonthlySpender } from '../utils/financial'
import { formatDate, formatMoney } from '../utils/format'
import { useCoupleRequired } from '../hooks/useCoupleRequired'

function nameFor(id: string | null | undefined, profile: UserProfile | null, partner: UserProfile | null) {
  if (!id) return 'Usuario no disponible'
  if (id === profile?.id) return profile.full_name ?? 'Tú'
  if (id === partner?.id) return partner.full_name ?? 'Tu pareja'
  return 'Usuario no disponible'
}

export function FinancesPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile, partner } = useCoupleRequired()
  const pushToast = useToastStore((state) => state.push)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<DebtSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingSettlement, setEditingSettlement] = useState<DebtSettlement | null>(null)

  const members = useMemo(() => [profile, partner].filter(Boolean) as UserProfile[], [partner, profile])
  const expenseForm = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    mode: 'onChange',
    defaultValues: { split_type: '50_50', date: new Date().toISOString().slice(0, 10), paid_by: profile?.id ?? '' },
  })
  const settlementForm = useForm<SettlementInput>({
    resolver: zodResolver(settlementSchema),
    mode: 'onChange',
  })

  const refresh = useCallback(async () => {
    if (!couple) return
    const [expenseRows, settlementRows] = await Promise.all([listExpenses(couple.id), listSettlements(couple.id)])
    setExpenses(expenseRows)
    setSettlements(settlementRows)
  }, [couple])

  useEffect(() => {
    if (!couple) return
    Promise.all([listExpenses(couple.id), listSettlements(couple.id)])
      .then(([expenseRows, settlementRows]) => {
        setExpenses(expenseRows)
        setSettlements(settlementRows)
      })
      .finally(() => setLoading(false))
    return subscribeToExpenses(couple.id, () => {
      void refresh()
    })
  }, [couple, refresh])

  const balance = useMemo(() => {
    if (!profile || !partner) return null
    return calculateNetBalance(expenses, profile.id, partner.id, settlements)
  }, [expenses, partner, profile, settlements])
  const chartData = useMemo(() => monthlyTotalsByCategory(expenses), [expenses])
  const topSpender = useMemo(() => topMonthlySpender(expenses), [expenses])

  function partnerPercentageFor(expense: Expense) {
    if (expense.split_type !== 'custom' || !partner?.id) return undefined
    const value = expense.split_details?.percentages?.[partner.id]
    return value == null ? undefined : Number(value)
  }

  function openExpenseModal() {
    setEditingExpense(null)
    expenseForm.reset({ split_type: '50_50', date: new Date().toISOString().slice(0, 10), paid_by: profile?.id ?? '', partner_percentage: undefined })
    setExpenseOpen(true)
  }

  function openEditExpenseModal(expense: Expense) {
    setEditingExpense(expense)
    expenseForm.reset({
      amount: Number(expense.amount),
      category: expense.category,
      description: expense.description ?? '',
      date: expense.date,
      paid_by: expense.paid_by,
      split_type: expense.split_type,
      partner_percentage: partnerPercentageFor(expense),
    })
    setExpenseOpen(true)
  }

  function closeExpenseModal() {
    setExpenseOpen(false)
    setEditingExpense(null)
  }

  function openSettlementModal() {
    setEditingSettlement(null)
    settlementForm.reset({ amount: undefined, from_user: '', to_user: '', note: '' })
    setSettlementOpen(true)
  }

  function openEditSettlementModal(settlement: DebtSettlement) {
    setEditingSettlement(settlement)
    settlementForm.reset({
      amount: Number(settlement.amount),
      from_user: settlement.from_user,
      to_user: settlement.to_user,
      note: settlement.note ?? '',
    })
    setSettlementOpen(true)
  }

  function closeSettlementModal() {
    setSettlementOpen(false)
    setEditingSettlement(null)
  }

  async function onExpenseSubmit(input: ExpenseInput) {
    if (!couple || !profile || !partner) {
      pushToast({ type: 'error', title: 'Gasto no permitido', description: 'Necesitas una pareja vinculada para crear gastos compartidos.' })
      return
    }
    setBusy(true)
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, profile.id, partner.id, input)
      } else {
        await createExpense(couple.id, profile.id, partner.id, input)
      }
      await refresh()
      expenseForm.reset({ split_type: '50_50', date: new Date().toISOString().slice(0, 10), paid_by: profile.id })
      closeExpenseModal()
      pushToast({ type: 'success', title: editingExpense ? 'Gasto actualizado' : 'Gasto registrado' })
    } catch (error) {
      pushToast({ type: 'error', title: editingExpense ? 'No pudimos actualizar el gasto' : 'No pudimos registrar el gasto', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function onSettlementSubmit(input: SettlementInput) {
    if (!couple) return
    setBusy(true)
    try {
      if (editingSettlement) {
        await updateSettlement(editingSettlement.id, input)
      } else {
        await createSettlement(couple.id, input)
      }
      await refresh()
      settlementForm.reset()
      closeSettlementModal()
      pushToast({
        type: 'success',
        title: editingSettlement ? 'Liquidacion actualizada' : 'Liquidacion registrada',
        description: editingSettlement ? undefined : 'Los gastos abiertos fueron marcados como liquidados.',
      })
    } catch (error) {
      pushToast({ type: 'error', title: editingSettlement ? 'No pudimos actualizar la liquidacion' : 'No pudimos liquidar', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function removeExpense(expense: Expense) {
    await deleteExpense(expense.id)
    await refresh()
    pushToast({ type: 'success', title: 'Gasto eliminado' })
  }

  if (!hasCouple) {
    return (
      <EmptyState
        title="Vincula tu pareja para usar finanzas"
        description="Sin pareja vinculada no se permite crear gastos compartidos. Al vincular, verán balance, liquidaciones y totales del mes."
        actionLabel="Ir a pareja"
        onAction={() => navigate('/app/couple')}
      />
    )
  }

  const balanceText =
    balance && balance.amount > 0
      ? `${nameFor(balance.debtorId, profile, partner)} debe ${formatMoney(balance.amount)} a ${nameFor(balance.creditorId, profile, partner)}`
      : 'Están a mano'

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Finanzas</h1>
          <p className="mt-1 text-stone-600 dark:text-stone-300">Gastos y liquidaciones son conceptos separados.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" icon={<HandCoins size={18} />} onClick={openSettlementModal}>
            Liquidar
          </Button>
          <Button icon={<Plus size={18} />} onClick={openExpenseModal}>
            Gasto
          </Button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Balance actual" value={balanceText} icon={<CircleDollarSign size={22} />} />
            <StatCard label="Gastos del mes" value={formatMoney(chartData.reduce((sum, item) => sum + item.total, 0))} icon={<ReceiptText size={22} />} />
            <StatCard
              label="Quién gastó más este mes"
              value={topSpender ? `${nameFor(topSpender[0], profile, partner)} · ${formatMoney(topSpender[1])}` : 'Sin gastos'}
              icon={<HandCoins size={22} />}
            />
          </div>

          <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Total mensual por categoría</h2>
            <div className="mt-4 h-72">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Bar dataKey="total" fill="#c85072" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-stone-500 dark:text-stone-400">Sin gastos este mes.</p>
              )}
            </div>
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Gastos</h2>
              <div className="mt-4 space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                    <div>
                      <p className="font-semibold text-stone-950 dark:text-white">{expense.category}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        {formatMoney(Number(expense.amount))} · {nameFor(expense.paid_by, profile, partner)} · {formatDate(expense.date)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {expense.split_type} · {expense.settled ? 'Liquidado' : 'Abierto'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="h-9 min-h-9 w-9 rounded-full px-0" onClick={() => openEditExpenseModal(expense)} aria-label="Editar gasto">
                        <Pencil size={16} />
                      </Button>
                      <Button variant="ghost" className="h-9 min-h-9 w-9 rounded-full px-0" onClick={() => void removeExpense(expense)} aria-label="Eliminar gasto">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                {!expenses.length ? <p className="text-sm text-stone-500 dark:text-stone-400">Sin gastos registrados.</p> : null}
              </div>
            </article>

            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Historial de liquidaciones</h2>
              <div className="mt-4 space-y-3">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                    <div>
                      <p className="font-semibold text-stone-950 dark:text-white">{formatMoney(Number(settlement.amount))}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        {nameFor(settlement.from_user, profile, partner)} pagó a {nameFor(settlement.to_user, profile, partner)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">{formatDate(settlement.settled_at)}</p>
                    </div>
                    <Button variant="ghost" className="h-9 min-h-9 w-9 rounded-full px-0" onClick={() => openEditSettlementModal(settlement)} aria-label="Editar liquidacion">
                      <Pencil size={16} />
                    </Button>
                  </div>
                ))}
                {!settlements.length ? <p className="text-sm text-stone-500 dark:text-stone-400">Sin liquidaciones.</p> : null}
              </div>
            </article>
          </div>
        </>
      )}

      <Modal open={expenseOpen} title={editingExpense ? 'Editar gasto' : 'Registrar gasto'} onClose={closeExpenseModal}>
        <form className="space-y-4" onSubmit={expenseForm.handleSubmit(onExpenseSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Monto" type="number" step="0.01" error={expenseForm.formState.errors.amount?.message} {...expenseForm.register('amount', { valueAsNumber: true })} />
            <Input label="Categoría" error={expenseForm.formState.errors.category?.message} {...expenseForm.register('category')} />
          </div>
          <Input label="Descripción" error={expenseForm.formState.errors.description?.message} {...expenseForm.register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Fecha" type="date" error={expenseForm.formState.errors.date?.message} {...expenseForm.register('date')} />
            <Select label="Pagó" error={expenseForm.formState.errors.paid_by?.message} {...expenseForm.register('paid_by')}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {nameFor(member.id, profile, partner)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="División" error={expenseForm.formState.errors.split_type?.message} {...expenseForm.register('split_type')}>
              <option value="50_50">50/50</option>
              <option value="one_paid">Uno pagó todo</option>
              <option value="custom">Custom</option>
            </Select>
            <Input label="% de tu pareja" type="number" min="0" max="100" error={expenseForm.formState.errors.partner_percentage?.message} {...expenseForm.register('partner_percentage', { valueAsNumber: true })} />
          </div>
          <Button className="w-full" disabled={busy}>
            {editingExpense ? 'Guardar cambios' : 'Guardar gasto'}
          </Button>
        </form>
      </Modal>

      <Modal open={settlementOpen} title={editingSettlement ? 'Editar liquidacion' : 'Registrar liquidacion'} onClose={closeSettlementModal}>
        <form className="space-y-4" onSubmit={settlementForm.handleSubmit(onSettlementSubmit)}>
          <Input label="Monto" type="number" step="0.01" error={settlementForm.formState.errors.amount?.message} {...settlementForm.register('amount', { valueAsNumber: true })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Paga" error={settlementForm.formState.errors.from_user?.message} {...settlementForm.register('from_user')}>
              <option value="">Seleccionar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {nameFor(member.id, profile, partner)}
                </option>
              ))}
            </Select>
            <Select label="Recibe" error={settlementForm.formState.errors.to_user?.message} {...settlementForm.register('to_user')}>
              <option value="">Seleccionar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {nameFor(member.id, profile, partner)}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Nota" error={settlementForm.formState.errors.note?.message} {...settlementForm.register('note')} />
          <Button className="w-full" disabled={busy}>
            {editingSettlement ? 'Guardar cambios' : 'Registrar liquidacion'}
          </Button>
        </form>
      </Modal>
    </section>
  )
}
