import { zodResolver } from '@hookform/resolvers/zod'
import { addMonths, format, isSameMonth, parseISO, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Target,
  Trash2,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Select } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { useCoupleRequired } from '../hooks/useCoupleRequired'
import { useFinance } from '../hooks/useFinance'
import { expenseSchema, settlementSchema, type ExpenseFormInput, type ExpenseInput, type SettlementInput } from '../lib/validations/expenses'
import { recordPartnerActivity } from '../services/activityNotificationsService'
import { createExpense, createSettlement, deleteExpense, updateExpense, updateSettlement } from '../services/expensesService'
import { useToastStore } from '../store/toastStore'
import type { DebtSettlement, Expense, UserProfile } from '../types/app'
import { expenseActivity, markModuleActivitySeen } from '../utils/activity'
import { calculateNetBalance, monthlyTotalsByCategory, topMonthlySpender } from '../utils/financial'
import { formatDate, formatMoney } from '../utils/format'

function nameFor(id: string | null | undefined, profile: UserProfile | null, partner: UserProfile | null) {
  if (!id) return 'Usuario no disponible'
  if (id === profile?.id) return profile.full_name ?? 'Tu'
  if (id === partner?.id) return partner.full_name ?? 'Tu pareja'
  return 'Usuario no disponible'
}

const splitPresets: { value: ExpenseInput['split_mode']; userPercent: number; partnerPercent: number }[] = [
  { value: '50_50', userPercent: 50, partnerPercent: 50 },
  { value: '60_40', userPercent: 60, partnerPercent: 40 },
  { value: '70_30', userPercent: 70, partnerPercent: 30 },
  { value: '80_20', userPercent: 80, partnerPercent: 20 },
  { value: '100_0', userPercent: 100, partnerPercent: 0 },
]

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function shareAmountFor(expense: Expense, userId: string) {
  const amount = Number(expense.amount)
  if (expense.split_type === '50_50') return roundMoney(amount / 2)
  if (expense.split_type === 'one_paid') return expense.paid_by === userId ? 0 : amount
  if (expense.split_details?.amounts?.[userId] != null) return roundMoney(Number(expense.split_details.amounts[userId]))
  if (expense.split_details?.percentages?.[userId] != null) return roundMoney(amount * (Number(expense.split_details.percentages[userId]) / 100))
  return roundMoney(amount / 2)
}

function splitLabelForExpense(expense: Expense, profile: UserProfile | null, partner: UserProfile | null) {
  if (!profile || !partner) return expense.split_type
  if (expense.split_details?.amounts) return 'Monto fijo'

  const profileShare = shareAmountFor(expense, profile.id)
  const partnerShare = shareAmountFor(expense, partner.id)
  const amount = Number(expense.amount)
  const profilePercent = amount ? Math.round((profileShare / amount) * 100) : 0
  const partnerPercent = amount ? Math.round((partnerShare / amount) * 100) : 0
  return `${profilePercent}/${partnerPercent}`
}

function isExpenseInMonth(expense: Expense, month: Date) {
  return isSameMonth(parseISO(expense.date), month)
}

function isSettlementInMonth(settlement: DebtSettlement, month: Date) {
  return isSameMonth(parseISO(settlement.settled_at), month)
}

function monthLabel(month: Date) {
  return format(month, 'MMMM yyyy', { locale: es })
}

function expenseFormValues(expense: Expense, profile: UserProfile | null, partner: UserProfile | null): ExpenseInput {
  const amount = Number(expense.amount)
  const profileShare = profile ? shareAmountFor(expense, profile.id) : amount / 2
  const partnerShare = partner ? shareAmountFor(expense, partner.id) : amount / 2
  const profilePercent = amount ? Math.round((profileShare / amount) * 100) : 50
  const partnerPercent = amount ? Math.round((partnerShare / amount) * 100) : 50
  const matchingPreset = splitPresets.find((preset) => preset.userPercent === profilePercent && preset.partnerPercent === partnerPercent)

  return {
    amount,
    category: expense.category,
    category_id: expense.category_id ?? undefined,
    subcategory_id: expense.subcategory_id ?? undefined,
    account_id: expense.account_id ?? '',
    description: expense.description ?? '',
    date: expense.date,
    paid_by: expense.paid_by,
    split_mode: expense.split_details?.amounts ? 'custom_amount' : (matchingPreset?.value ?? 'custom_percent'),
    custom_user_percentage: profilePercent,
    custom_partner_percentage: partnerPercent,
    user_amount: profileShare,
    partner_amount: partnerShare,
  }
}

export function FinancesPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile, partner } = useCoupleRequired()
  const pushToast = useToastStore((state) => state.push)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingSettlement, setEditingSettlement] = useState<DebtSettlement | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const finance = useFinance(couple?.id, profile?.id)
  const { expenses, settlements, accounts, categories, subcategories, loading, refresh, createDefaultAccount } = finance

  const members = useMemo(() => [profile, partner].filter(Boolean) as UserProfile[], [partner, profile])
  const expenseForm = useForm<ExpenseFormInput, unknown, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    mode: 'onChange',
    defaultValues: { split_mode: '50_50', date: new Date().toISOString().slice(0, 10), paid_by: profile?.id ?? '', account_id: '' },
  })
  const settlementForm = useForm<SettlementInput>({
    resolver: zodResolver(settlementSchema),
    mode: 'onChange',
  })
  const splitMode = useWatch({ control: expenseForm.control, name: 'split_mode' })
  const expenseAmount = useWatch({ control: expenseForm.control, name: 'amount' })
  const paidBy = useWatch({ control: expenseForm.control, name: 'paid_by' })
  const customUserPercentage = useWatch({ control: expenseForm.control, name: 'custom_user_percentage' })
  const customPartnerPercentage = useWatch({ control: expenseForm.control, name: 'custom_partner_percentage' })
  const userAmount = useWatch({ control: expenseForm.control, name: 'user_amount' })
  const partnerAmount = useWatch({ control: expenseForm.control, name: 'partner_amount' })
  const categoryId = useWatch({ control: expenseForm.control, name: 'category_id' })
  const watchedLinkedExpenseIds = useWatch({ control: settlementForm.control, name: 'linked_expense_ids' })
  const linkedExpenseIds = useMemo(() => watchedLinkedExpenseIds ?? [], [watchedLinkedExpenseIds])

  useEffect(() => {
    if (profile) markModuleActivitySeen(profile.id, 'finances', expenses.map(expenseActivity))
  }, [expenses, profile])

  const balance = useMemo(() => {
    if (!profile || !partner) return null
    return calculateNetBalance(expenses, profile.id, partner.id, settlements)
  }, [expenses, partner, profile, settlements])
  const monthExpenses = useMemo(() => expenses.filter((expense) => isExpenseInMonth(expense, selectedMonth)), [expenses, selectedMonth])
  const monthSettlements = useMemo(() => settlements.filter((settlement) => isSettlementInMonth(settlement, selectedMonth)), [settlements, selectedMonth])
  const chartData = useMemo(() => monthlyTotalsByCategory(expenses, selectedMonth), [expenses, selectedMonth])
  const topSpender = useMemo(() => topMonthlySpender(expenses, selectedMonth), [expenses, selectedMonth])
  const monthTotal = useMemo(() => monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0), [monthExpenses])
  const openExpenses = useMemo(() => expenses.filter((expense) => !expense.settled), [expenses])
  const monthOpenTotal = useMemo(() => monthExpenses.filter((expense) => !expense.settled).reduce((sum, expense) => sum + Number(expense.amount), 0), [monthExpenses])
  const biggestCategory = chartData[0] ?? null
  const hasMonthData = monthExpenses.length > 0
  const filteredSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.category_id === categoryId), [categoryId, subcategories])
  const selectedSettlementExpensesTotal = useMemo(
    () => openExpenses.filter((expense) => linkedExpenseIds.includes(expense.id)).reduce((sum, expense) => sum + Number(expense.amount), 0),
    [linkedExpenseIds, openExpenses],
  )

  const splitSummary = useMemo(() => {
    if (!profile || !partner || !expenseAmount || expenseAmount <= 0) return null

    const preset = splitPresets.find((item) => item.value === splitMode)
    const profileShare =
      splitMode === 'custom_amount'
        ? roundMoney(Number(userAmount ?? 0))
        : roundMoney(Number(expenseAmount) * (Number(preset?.userPercent ?? customUserPercentage ?? 50) / 100))
    const partnerShare =
      splitMode === 'custom_amount'
        ? roundMoney(Number(partnerAmount ?? 0))
        : roundMoney(Number(expenseAmount) * (Number(preset?.partnerPercent ?? customPartnerPercentage ?? 50) / 100))
    const debtor = paidBy === profile.id ? partner : profile
    const creditor = paidBy === profile.id ? profile : partner
    const debtAmount = paidBy === profile.id ? partnerShare : profileShare

    return {
      payerName: nameFor(paidBy, profile, partner),
      profileShare,
      partnerShare,
      debtorName: debtor.full_name ?? 'Tu pareja',
      creditorName: creditor.full_name ?? 'Tu',
      debtAmount,
    }
  }, [customPartnerPercentage, customUserPercentage, expenseAmount, paidBy, partner, partnerAmount, profile, splitMode, userAmount])

  function openExpenseModal() {
    setEditingExpense(null)
    expenseForm.reset({
      amount: undefined,
      description: '',
      split_mode: '50_50',
      date: new Date().toISOString().slice(0, 10),
      paid_by: profile?.id ?? '',
      account_id: accounts[0]?.id ?? '',
      category: categories[0]?.name ?? '',
      category_id: categories[0]?.id,
      subcategory_id: undefined,
      custom_user_percentage: 50,
      custom_partner_percentage: 50,
      user_amount: undefined,
      partner_amount: undefined,
    })
    setExpenseOpen(true)
  }

  function openEditExpenseModal(expense: Expense) {
    setEditingExpense(expense)
    expenseForm.reset(expenseFormValues(expense, profile, partner))
    setExpenseOpen(true)
  }

  function closeExpenseModal() {
    setExpenseOpen(false)
    setEditingExpense(null)
  }

  function openSettlementModal() {
    setEditingSettlement(null)
    settlementForm.reset({
      amount: undefined,
      from_user: '',
      to_user: '',
      payment_method: '',
      settlement_date: new Date().toISOString().slice(0, 10),
      linked_expense_ids: [],
      note: '',
    })
    setSettlementOpen(true)
  }

  function openEditSettlementModal(settlement: DebtSettlement) {
    setEditingSettlement(settlement)
    settlementForm.reset({
      amount: Number(settlement.amount),
      from_user: settlement.from_user,
      to_user: settlement.to_user,
      payment_method: settlement.payment_method ?? '',
      settlement_date: settlement.settlement_date ?? settlement.settled_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      linked_expense_ids: settlement.linked_expense_ids ?? [],
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
        const updated = await updateExpense(editingExpense.id, profile.id, partner.id, input)
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner.id,
          module: 'finances',
          action: 'updated',
          entityType: 'expense',
          entityId: updated.id,
          title: updated.category,
          body: 'Edito un gasto.',
          oldData: { ...editingExpense },
          newData: { ...updated },
        })
      } else {
        const created = await createExpense(couple.id, profile.id, partner.id, input)
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner.id,
          module: 'finances',
          action: 'created',
          entityType: 'expense',
          entityId: created.id,
          title: created.category,
          body: 'Registro un gasto.',
          newData: { ...created },
        })
      }
      await refresh()
      expenseForm.reset({
        split_mode: '50_50',
        date: new Date().toISOString().slice(0, 10),
        paid_by: profile.id,
        account_id: accounts[0]?.id ?? '',
        category: categories[0]?.name ?? '',
        category_id: categories[0]?.id,
      })
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
        const updated = await updateSettlement(editingSettlement.id, input)
        if (profile && partner) {
          void recordPartnerActivity({
            coupleId: couple.id,
            actorId: profile.id,
            targetUserId: partner.id,
            module: 'finances',
            action: 'updated',
            entityType: 'debt_settlement',
            entityId: updated.id,
            title: 'Liquidacion actualizada',
            body: 'Edito una liquidacion.',
            oldData: { ...editingSettlement },
            newData: { ...updated },
          })
        }
      } else {
        const created = await createSettlement(couple.id, profile?.id ?? '', input)
        if (profile && partner) {
          void recordPartnerActivity({
            coupleId: couple.id,
            actorId: profile.id,
            targetUserId: partner.id,
            module: 'finances',
            action: 'settled',
            entityType: 'debt_settlement',
            entityId: created.id,
            title: 'Liquidacion registrada',
            body: 'Registro una liquidacion de deuda.',
            newData: { ...created },
          })
        }
      }
      await refresh()
      settlementForm.reset()
      closeSettlementModal()
      pushToast({
        type: 'success',
        title: editingSettlement ? 'Liquidacion actualizada' : 'Liquidacion registrada',
        description: editingSettlement ? undefined : 'Solo los gastos seleccionados fueron marcados como liquidados.',
      })
    } catch (error) {
      pushToast({ type: 'error', title: editingSettlement ? 'No pudimos actualizar la liquidacion' : 'No pudimos liquidar', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function removeExpense(expense: Expense) {
    await deleteExpense(expense.id)
    if (couple && profile && partner) {
      void recordPartnerActivity({
        coupleId: couple.id,
        actorId: profile.id,
        targetUserId: partner.id,
        module: 'finances',
        action: 'deleted',
        entityType: 'expense',
        entityId: expense.id,
        title: expense.category,
        body: 'Elimino un gasto.',
        oldData: { ...expense },
      })
    }
    await refresh()
    pushToast({ type: 'success', title: 'Gasto eliminado' })
  }

  if (!hasCouple) {
    return (
      <EmptyState
        title="Vincula tu pareja para usar finanzas"
        description="Sin pareja vinculada no se permite crear gastos compartidos. Al vincular, veran balance, liquidaciones y totales del mes."
        actionLabel="Ir a pareja"
        onAction={() => navigate('/app/couple')}
      />
    )
  }

  const balanceText =
    balance && balance.amount > 0
      ? `${nameFor(balance.debtorId, profile, partner)} debe ${formatMoney(balance.amount)} a ${nameFor(balance.creditorId, profile, partner)}`
      : 'Estan a mano'

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Finanzas</h1>
          <p className="mt-1 text-stone-600 dark:text-stone-300">Gastos, balances y liquidaciones en peso dominicano.</p>
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
          <article className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blush-100 text-blush-700 dark:bg-blush-900/30 dark:text-blush-200">
                <CalendarDays size={22} />
              </div>
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400">Vista mensual</p>
                <h2 className="text-xl font-semibold capitalize text-stone-950 dark:text-white">{monthLabel(selectedMonth)}</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="h-10 min-h-10 px-3" onClick={() => setSelectedMonth((month) => subMonths(month, 1))} aria-label="Mes anterior">
                <ChevronLeft size={18} />
              </Button>
              <Button variant="secondary" className="h-10 min-h-10" onClick={() => setSelectedMonth(startOfMonth(new Date()))}>
                Mes actual
              </Button>
              <Button variant="secondary" className="h-10 min-h-10 px-3" onClick={() => setSelectedMonth((month) => addMonths(month, 1))} aria-label="Mes siguiente">
                <ChevronRight size={18} />
              </Button>
            </div>
          </article>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Balance actual" value={balanceText} icon={<CircleDollarSign size={22} />} />
            <StatCard label="Gastos del mes" value={formatMoney(monthTotal)} icon={<ReceiptText size={22} />} />
            <StatCard label="Abierto por liquidar" value={formatMoney(monthOpenTotal)} icon={<WalletCards size={22} />} />
            <StatCard
              label="Quien gasto mas"
              value={topSpender ? `${nameFor(topSpender[0], profile, partner)} · ${formatMoney(topSpender[1])}` : 'Sin gastos'}
              icon={<HandCoins size={22} />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Total mensual por categoria</h2>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Comparen donde se esta yendo el dinero este mes.</p>
                </div>
                {biggestCategory ? (
                  <span className="rounded-full bg-blush-100 px-3 py-1 text-sm font-semibold text-blush-700 dark:bg-blush-900/30 dark:text-blush-100">
                    Mayor: {biggestCategory.category}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 h-80">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="category" tickLine={false} axisLine={false} />
                      <YAxis width={88} tickFormatter={(value) => formatMoney(Number(value)).replace('DOP', 'RD$')} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => formatMoney(Number(value))} cursor={{ fill: 'rgba(200,80,114,0.08)' }} />
                      <Bar dataKey="total" fill="#c85072" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/70 bg-white/45 p-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
                    <ReceiptText className="text-blush-500" size={34} />
                    <h3 className="mt-3 text-lg font-semibold text-stone-950 dark:text-white">Aun no hay gastos este mes</h3>
                    <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">
                      Registra el primer gasto para activar el grafico, el balance y la lectura de quien pago mas.
                    </p>
                    <Button className="mt-5" icon={<Plus size={18} />} onClick={openExpenseModal}>
                      Registrar gasto
                    </Button>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Lectura rapida</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-blush-600 dark:text-blush-200">
                    <PiggyBank size={18} />
                    <p className="font-semibold">Control del mes</p>
                  </div>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                    {hasMonthData
                      ? `Tienen ${monthExpenses.length} gasto${monthExpenses.length === 1 ? '' : 's'} registrado${monthExpenses.length === 1 ? '' : 's'} en ${monthLabel(selectedMonth)}.`
                      : 'Cuando registren gastos, aqui veran senales utiles sin tener que calcular nada.'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-blush-600 dark:text-blush-200">
                    <Target size={18} />
                    <p className="font-semibold">Siguiente mejora</p>
                  </div>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                    Presupuestos por categoria y gastos recurrentes seran el proximo paso natural para que Finanzas avise antes de pasarse.
                  </p>
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Gastos de {monthLabel(selectedMonth)}</h2>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-stone-500 dark:bg-white/10 dark:text-stone-300">
                  {monthExpenses.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {monthExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-stone-950 dark:text-white">{expense.category}</p>
                        <span className="rounded-full bg-blush-100 px-2.5 py-1 text-xs font-semibold text-blush-700 dark:bg-blush-900/30 dark:text-blush-100">
                          {splitLabelForExpense(expense, profile, partner)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                        {formatMoney(Number(expense.amount))} · pago {nameFor(expense.paid_by, profile, partner)} · {formatDate(expense.date)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">{expense.settled ? 'Liquidado' : 'Abierto'}</p>
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
                {!monthExpenses.length ? (
                  <div className="rounded-2xl border border-dashed border-white/70 bg-white/45 p-4 text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-400">
                    No hay gastos en este mes. Usa el selector de mes o registra uno nuevo.
                  </div>
                ) : null}
              </div>
            </article>

            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Liquidaciones del mes</h2>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-stone-500 dark:bg-white/10 dark:text-stone-300">
                  Pendientes: {openExpenses.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {monthSettlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                    <div>
                      <p className="font-semibold text-stone-950 dark:text-white">{formatMoney(Number(settlement.amount))}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        {nameFor(settlement.from_user, profile, partner)} pago a {nameFor(settlement.to_user, profile, partner)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">{formatDate(settlement.settled_at)}</p>
                    </div>
                    <Button variant="ghost" className="h-9 min-h-9 w-9 rounded-full px-0" onClick={() => openEditSettlementModal(settlement)} aria-label="Editar liquidacion">
                      <Pencil size={16} />
                    </Button>
                  </div>
                ))}
                {!monthSettlements.length ? (
                  <div className="rounded-2xl border border-dashed border-white/70 bg-white/45 p-4 text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-400">
                    Sin liquidaciones en este mes. Cuando se paguen una deuda, quedara aqui el historial.
                  </div>
                ) : null}
              </div>
            </article>
          </div>
        </>
      )}

      <Modal open={expenseOpen} title={editingExpense ? 'Editar gasto' : 'Registrar gasto'} onClose={closeExpenseModal}>
        <form className="space-y-4" onSubmit={expenseForm.handleSubmit(onExpenseSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Monto" type="number" step="0.01" error={expenseForm.formState.errors.amount?.message} {...expenseForm.register('amount', { valueAsNumber: true })} />
            {categories.length ? (
              <Select
                label="Categoria"
                error={expenseForm.formState.errors.category?.message ?? expenseForm.formState.errors.category_id?.message}
                value={categoryId ?? ''}
                onChange={(event) => {
                  const category = categories.find((item) => item.id === event.target.value)
                  expenseForm.setValue('category_id', category?.id, { shouldValidate: true })
                  expenseForm.setValue('category', category?.name ?? '', { shouldValidate: true })
                  expenseForm.setValue('subcategory_id', undefined, { shouldValidate: true })
                }}
              >
                <option value="">Seleccionar</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input label="Categoria" error={expenseForm.formState.errors.category?.message} {...expenseForm.register('category')} />
            )}
            {categories.length ? <input type="hidden" {...expenseForm.register('category')} /> : null}
          </div>
          <Input label="Descripcion" error={expenseForm.formState.errors.description?.message} {...expenseForm.register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Fecha" type="date" error={expenseForm.formState.errors.date?.message} {...expenseForm.register('date')} />
            <Select label="Pago" error={expenseForm.formState.errors.paid_by?.message} {...expenseForm.register('paid_by')}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {nameFor(member.id, profile, partner)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Cuenta" error={expenseForm.formState.errors.account_id?.message} {...expenseForm.register('account_id')}>
              <option value="">Seleccionar cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <Select label="Subcategoria" {...expenseForm.register('subcategory_id')} disabled={!filteredSubcategories.length}>
              <option value="">Sin subcategoria</option>
              {filteredSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </Select>
          </div>
          {!accounts.length ? (
            <div className="rounded-2xl border border-dashed border-blush-200 bg-blush-50/60 p-3 text-sm text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
              <p className="font-semibold text-stone-950 dark:text-white">Primero creen una cuenta</p>
              <p className="mt-1">Esto permite saber de donde salio el dinero.</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  void createDefaultAccount().then((account) => {
                    if (account) expenseForm.setValue('account_id', account.id, { shouldValidate: true })
                  })
                }}
              >
                Crear cuenta efectivo
              </Button>
            </div>
          ) : null}
          <section className="space-y-3 rounded-2xl bg-white/65 p-4 dark:bg-white/5">
            <div>
              <h3 className="font-semibold text-stone-950 dark:text-white">Division del gasto</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">El primer numero es para {profile?.full_name ?? 'ti'} y el segundo para {partner?.full_name ?? 'tu pareja'}.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {splitPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={[
                    'min-h-10 rounded-2xl px-3 text-sm font-semibold transition',
                    splitMode === preset.value
                      ? 'bg-blush-500 text-white shadow-soft'
                      : 'bg-white text-stone-600 hover:bg-blush-50 hover:text-blush-700 dark:bg-white/5 dark:text-stone-300 dark:hover:bg-white/10',
                  ].join(' ')}
                  onClick={() => expenseForm.setValue('split_mode', preset.value, { shouldValidate: true })}
                >
                  {preset.userPercent}/{preset.partnerPercent}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={[
                  'min-h-10 rounded-2xl px-3 text-sm font-semibold transition',
                  splitMode === 'custom_percent'
                    ? 'bg-blush-500 text-white shadow-soft'
                    : 'bg-white text-stone-600 hover:bg-blush-50 hover:text-blush-700 dark:bg-white/5 dark:text-stone-300 dark:hover:bg-white/10',
                ].join(' ')}
                onClick={() => expenseForm.setValue('split_mode', 'custom_percent', { shouldValidate: true })}
              >
                Porcentaje personalizado
              </button>
              <button
                type="button"
                className={[
                  'min-h-10 rounded-2xl px-3 text-sm font-semibold transition',
                  splitMode === 'custom_amount'
                    ? 'bg-blush-500 text-white shadow-soft'
                    : 'bg-white text-stone-600 hover:bg-blush-50 hover:text-blush-700 dark:bg-white/5 dark:text-stone-300 dark:hover:bg-white/10',
                ].join(' ')}
                onClick={() => expenseForm.setValue('split_mode', 'custom_amount', { shouldValidate: true })}
              >
                Montos exactos
              </button>
            </div>

            {splitMode === 'custom_percent' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={`% de ${profile?.full_name ?? 'ti'}`}
                  type="number"
                  min="0"
                  max="100"
                  error={expenseForm.formState.errors.custom_user_percentage?.message}
                  {...expenseForm.register('custom_user_percentage', { valueAsNumber: true })}
                />
                <Input
                  label={`% de ${partner?.full_name ?? 'tu pareja'}`}
                  type="number"
                  min="0"
                  max="100"
                  error={expenseForm.formState.errors.custom_partner_percentage?.message}
                  {...expenseForm.register('custom_partner_percentage', { valueAsNumber: true })}
                />
              </div>
            ) : null}

            {splitMode === 'custom_amount' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={`Monto de ${profile?.full_name ?? 'ti'}`}
                  type="number"
                  min="0"
                  step="0.01"
                  error={expenseForm.formState.errors.user_amount?.message}
                  {...expenseForm.register('user_amount', { valueAsNumber: true })}
                />
                <Input
                  label={`Monto de ${partner?.full_name ?? 'tu pareja'}`}
                  type="number"
                  min="0"
                  step="0.01"
                  error={expenseForm.formState.errors.partner_amount?.message}
                  {...expenseForm.register('partner_amount', { valueAsNumber: true })}
                />
              </div>
            ) : null}

            {splitSummary ? (
              <div className="rounded-2xl bg-blush-50/80 p-3 text-sm text-stone-700 dark:bg-white/5 dark:text-stone-200">
                <p className="font-semibold text-stone-950 dark:text-white">Resumen antes de guardar</p>
                <p className="mt-2">Pago {splitSummary.payerName}: {formatMoney(Number(expenseAmount))}</p>
                <p>A {profile?.full_name ?? 'ti'} le corresponde: {formatMoney(splitSummary.profileShare)}</p>
                <p>A {partner?.full_name ?? 'tu pareja'} le corresponde: {formatMoney(splitSummary.partnerShare)}</p>
                <p className="mt-2 font-semibold">
                  {splitSummary.debtAmount > 0
                    ? `${splitSummary.debtorName} debe a ${splitSummary.creditorName}: ${formatMoney(splitSummary.debtAmount)}`
                    : 'Nadie queda debiendo por este gasto.'}
                </p>
              </div>
            ) : null}
          </section>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Fecha de liquidacion" type="date" error={settlementForm.formState.errors.settlement_date?.message} {...settlementForm.register('settlement_date')} />
            <Input label="Metodo de pago" placeholder="Efectivo, transferencia..." error={settlementForm.formState.errors.payment_method?.message} {...settlementForm.register('payment_method')} />
          </div>
          <section className="space-y-3 rounded-2xl bg-white/65 p-4 dark:bg-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-stone-950 dark:text-white">Gastos a saldar</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">La liquidacion solo marca como saldados los gastos seleccionados.</p>
              </div>
              {linkedExpenseIds.length ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 min-h-10"
                  onClick={() => settlementForm.setValue('amount', roundMoney(selectedSettlementExpensesTotal), { shouldValidate: true })}
                >
                  Usar {formatMoney(selectedSettlementExpensesTotal)}
                </Button>
              ) : null}
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {openExpenses.map((expense) => {
                const checked = linkedExpenseIds.includes(expense.id)
                return (
                  <label key={expense.id} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/70 p-3 text-sm dark:bg-white/5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blush-500"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...linkedExpenseIds, expense.id]
                          : linkedExpenseIds.filter((expenseId) => expenseId !== expense.id)
                        settlementForm.setValue('linked_expense_ids', next, { shouldValidate: true })
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-stone-950 dark:text-white">{expense.category}</span>
                      <span className="block text-stone-500 dark:text-stone-400">
                        {formatMoney(Number(expense.amount))} · {formatDate(expense.date)}
                      </span>
                    </span>
                  </label>
                )
              })}
              {!openExpenses.length ? (
                <p className="rounded-2xl border border-dashed border-white/70 bg-white/45 p-3 text-sm text-stone-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-400">
                  No hay gastos abiertos para saldar.
                </p>
              ) : null}
            </div>
            {settlementForm.formState.errors.linked_expense_ids?.message ? (
              <p className="text-xs font-medium text-red-500">{settlementForm.formState.errors.linked_expense_ids.message}</p>
            ) : null}
          </section>
          <Input label="Nota" error={settlementForm.formState.errors.note?.message} {...settlementForm.register('note')} />
          <Button className="w-full" disabled={busy}>
            {editingSettlement ? 'Guardar cambios' : 'Registrar liquidacion'}
          </Button>
        </form>
      </Modal>
    </section>
  )
}
