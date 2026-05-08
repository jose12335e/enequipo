import { CalendarDays, CheckCircle2, CircleDollarSign, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ListSkeleton } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { listEvents } from '../services/eventsService'
import { listExpenses, listSettlements } from '../services/expensesService'
import { listTasks } from '../services/tasksService'
import type { DebtSettlement, EventItem, Expense, TaskItem } from '../types/app'
import { formatDateTime, formatMoney } from '../utils/format'
import { calculateNetBalance } from '../utils/financial'
import { useCoupleRequired } from '../hooks/useCoupleRequired'

export function DashboardPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile, partner } = useCoupleRequired()
  const [events, setEvents] = useState<EventItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<DebtSettlement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!couple) return
    Promise.all([listEvents(couple.id), listTasks(couple.id), listExpenses(couple.id), listSettlements(couple.id)])
      .then(([eventRows, taskRows, expenseRows, settlementRows]) => {
        setEvents(eventRows)
        setTasks(taskRows)
        setExpenses(expenseRows)
        setSettlements(settlementRows)
      })
      .finally(() => setLoading(false))
  }, [couple])

  const pendingTasks = tasks.filter((task) => task.status !== 'done')
  const upcomingEvents = events.filter((event) => new Date(event.start_at) >= new Date()).slice(0, 3)
  const balance = useMemo(() => {
    if (!profile || !partner) return null
    return calculateNetBalance(expenses, profile.id, partner.id, settlements)
  }, [expenses, partner, profile, settlements])

  if (!hasCouple) {
    return (
      <EmptyState
        title="Tu espacio compartido está listo para vincularse"
        description="Cuando conectes tu pareja verás aquí eventos, tareas y balance financiero. Puedes crear un código o unirte desde el perfil de pareja."
        actionLabel="Ir a pareja"
        onAction={() => navigate('/app/couple')}
      />
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-300">Resumen del día para ustedes dos.</p>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Próximos eventos" value={String(upcomingEvents.length)} icon={<CalendarDays size={22} />} />
            <StatCard label="Tareas pendientes" value={String(pendingTasks.length)} icon={<CheckCircle2 size={22} />} />
            <StatCard label="Balance actual" value={balance ? formatMoney(balance.amount) : formatMoney(0)} icon={<CircleDollarSign size={22} />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] lg:col-span-2">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Próximos eventos</h2>
              <div className="mt-4 space-y-3">
                {upcomingEvents.length ? (
                  upcomingEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl bg-blush-50/80 p-4 dark:bg-white/5">
                      <p className="font-semibold text-stone-950 dark:text-white">{event.title}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500 dark:text-stone-400">Sin eventos próximos.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Tareas pendientes</h2>
              <div className="mt-4 space-y-3">
                {pendingTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="rounded-2xl bg-white/70 p-3 text-sm dark:bg-white/5">
                    <p className="font-semibold text-stone-950 dark:text-white">{task.title}</p>
                    <p className="text-stone-500 dark:text-stone-400">{task.priority ?? 'medium'}</p>
                  </div>
                ))}
                {!pendingTasks.length ? <p className="text-sm text-stone-500 dark:text-stone-400">Nada pendiente.</p> : null}
              </div>
            </article>
          </div>
        </>
      )}

      <Button
        className="fixed bottom-24 right-4 z-20 h-14 w-14 rounded-full px-0 md:hidden"
        aria-label="Crear tarea"
        icon={<Plus size={22} />}
        onClick={() => navigate('/app/tasks')}
      />
    </section>
  )
}
