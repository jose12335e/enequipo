import { CalendarDays, CheckCircle2, CircleDollarSign, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
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
  const now = useMemo(() => new Date(), [])
  const upcomingEvents = useMemo(() => events.filter((event) => new Date(event.start_at) >= now).slice(0, 3), [events, now])
  const memoryEvents = useMemo(
    () =>
      events
        .filter((event) => new Date(event.start_at) < now)
        .slice()
        .sort((left, right) => new Date(right.start_at).getTime() - new Date(left.start_at).getTime())
        .slice(0, 3),
    [events, now],
  )
  const profilesById = useMemo(() => {
    const map = new Map<string, typeof profile>()
    if (profile) map.set(profile.id, profile)
    if (partner) map.set(partner.id, partner)
    return map
  }, [partner, profile])
  const balance = useMemo(() => {
    if (!profile || !partner) return null
    return calculateNetBalance(expenses, profile.id, partner.id, settlements)
  }, [expenses, partner, profile, settlements])

  function eventIdentity(event: EventItem) {
    if ((event.actor_type ?? 'user') === 'couple') {
      return { src: couple?.avatar_url, name: 'Ambos', kind: 'couple' as const }
    }
    const author = profilesById.get(event.created_by)
    return { src: author?.avatar_url, name: author?.full_name ?? 'Usuario no disponible', kind: 'user' as const }
  }

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
        <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Inicio</h1>
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
                      <div className="flex gap-3">
                        <Avatar {...eventIdentity(event)} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-950 dark:text-white">{event.title}</p>
                          <p className="text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
                        </div>
                      </div>
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

          <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Recuerdos recientes</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {memoryEvents.length ? (
                memoryEvents.map((event) => (
                  <div key={event.id} className="flex gap-3 rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                    <Avatar {...eventIdentity(event)} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-950 dark:text-white">{event.title}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500 dark:text-stone-400 md:col-span-3">Cuando pasen eventos, apareceran aqui como recuerdos.</p>
              )}
            </div>
          </article>
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
