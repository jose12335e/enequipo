import { zodResolver } from '@hookform/resolvers/zod'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Select, Textarea } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { eventSchema, type EventFormInput, type EventInput } from '../lib/validations/events'
import { createEventSeries, deleteEvent, listEvents, subscribeToEvents, updateEvent, updateEventStatus } from '../services/eventsService'
import { recordPartnerActivity } from '../services/activityNotificationsService'
import { useToastStore } from '../store/toastStore'
import type { EventItem, EventStatus } from '../types/app'
import { formatDateTime } from '../utils/format'
import { useCoupleRequired } from '../hooks/useCoupleRequired'
import { eventActivity, getDefaultEventColor, markModuleActivitySeen } from '../utils/activity'

const eventStatusMeta: Record<EventStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-300/15 dark:text-amber-100',
    icon: Clock3,
  },
  done: {
    label: 'Hecho',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/15 dark:text-emerald-100',
    icon: CheckCircle2,
  },
  not_done: {
    label: 'No realizado',
    className: 'bg-red-100 text-red-800 dark:bg-red-300/15 dark:text-red-100',
    icon: XCircle,
  },
  postponed: {
    label: 'Pospuesto',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-300/15 dark:text-sky-100',
    icon: RotateCcw,
  },
}

const statusActions: EventStatus[] = ['pending', 'done', 'not_done', 'postponed']
const hourSlots = Array.from({ length: 18 }, (_, index) => index + 6)
type CalendarView = 'month' | 'week' | 'day'

function eventRange(event: EventItem) {
  const start = new Date(event.start_at)
  let end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + 60 * 60 * 1000)

  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }

  return { start, end }
}

function dayRange(day: Date) {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

function hourRange(day: Date, hour: number) {
  const start = new Date(day)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return { start, end }
}

function overlaps(left: { start: Date; end: Date }, right: { start: Date; end: Date }) {
  return left.start < right.end && left.end > right.start
}

function eventsForCalendarDay(events: EventItem[], day: Date) {
  const range = dayRange(day)
  return events
    .filter((event) => overlaps(eventRange(event), range))
    .slice()
    .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
}

export function CalendarPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile, partner } = useCoupleRequired()
  const pushToast = useToastStore((state) => state.push)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [statusTarget, setStatusTarget] = useState<{ event: EventItem; status: EventStatus } | null>(null)
  const [statusNote, setStatusNote] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<EventFormInput, unknown, EventInput>({
    resolver: zodResolver(eventSchema),
    mode: 'onChange',
    defaultValues: { is_shared: true, color: '#ef9fb5', actor_type: 'user', repeat_frequency: 'none', repeat_count: 1 },
  })
  const startAtField = useWatch({ control, name: 'start_at' })
  const endAtField = useWatch({ control, name: 'end_at' })
  const repeatFrequency = useWatch({ control, name: 'repeat_frequency' })

  function selectedDayValue() {
    return format(selectedDay, 'yyyy-MM-dd')
  }

  function toDateTimeInput(value: string) {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm")
  }

  function timeFromDateTime(value?: string) {
    if (!value) return ''
    return format(new Date(value), 'HH:mm')
  }

  function openEventModal() {
    const day = selectedDayValue()
    const defaultColor = getDefaultEventColor(profile)
    setEditingEvent(null)
    reset({
      title: '',
      description: '',
      start_at: `${day}T09:00`,
      end_at: `${day}T10:00`,
      location: '',
      color: defaultColor,
      is_shared: true,
      actor_type: 'user',
      repeat_frequency: 'none',
      repeat_count: 1,
    })
    setOpen(true)
  }

  function openEditEventModal(event: EventItem) {
    const eventDay = new Date(event.start_at)
    setSelectedDay(eventDay)
    setVisibleMonth(eventDay)
    setEditingEvent(event)
    reset({
      title: event.title,
      description: event.description ?? '',
      start_at: toDateTimeInput(event.start_at),
      end_at: event.end_at ? toDateTimeInput(event.end_at) : '',
      location: event.location ?? '',
      color: event.color ?? '#ef9fb5',
      is_shared: event.is_shared,
      actor_type: event.actor_type ?? 'user',
      repeat_frequency: 'none',
      repeat_count: 1,
    })
    setOpen(true)
  }

  function closeEventModal() {
    setOpen(false)
    setEditingEvent(null)
  }

  useEffect(() => {
    if (!couple) return
    listEvents(couple.id)
      .then((rows) => {
        setEvents(rows)
        if (profile) markModuleActivitySeen(profile.id, 'calendar', rows.map(eventActivity))
      })
      .finally(() => setLoading(false))
    return subscribeToEvents(couple.id, () => {
      void listEvents(couple.id).then((rows) => {
        setEvents(rows)
        if (profile) markModuleActivitySeen(profile.id, 'calendar', rows.map(eventActivity))
      })
    })
  }, [couple, profile])

  async function onSubmit(input: EventInput) {
    if (!couple || !profile) return
    setBusy(true)
    try {
      if (editingEvent) {
        const updated = await updateEvent(editingEvent.id, input)
        setEvents((current) => current.map((event) => (event.id === updated.id ? (updated as EventItem) : event)))
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner?.id,
          module: 'calendar',
          action: 'updated',
          entityType: 'event',
          entityId: updated.id,
          title: updated.title,
          body: 'Edito un evento del calendario.',
          oldData: { ...editingEvent },
          newData: { ...(updated as EventItem) },
        })
        pushToast({ type: 'success', title: 'Evento actualizado' })
      } else {
        const created = await createEventSeries(couple.id, profile.id, input)
        setEvents((current) => [...current, ...created])
        for (const event of created) {
          void recordPartnerActivity({
            coupleId: couple.id,
            actorId: profile.id,
            targetUserId: partner?.id,
            module: 'calendar',
            action: 'created',
            entityType: 'event',
            entityId: event.id,
            title: event.title,
            body: event.actor_type === 'couple' ? 'Agregaron un evento como pareja.' : 'Agrego un evento al calendario.',
            newData: { ...event },
          })
        }
        pushToast({
          type: 'success',
          title: created.length > 1 ? 'Eventos creados' : 'Evento creado',
          description: created.length > 1 ? `${created.length} semanas programadas.` : undefined,
        })
      }
      reset({
        title: '',
        description: '',
        start_at: `${selectedDayValue()}T09:00`,
        end_at: `${selectedDayValue()}T10:00`,
        location: '',
        color: getDefaultEventColor(profile),
        is_shared: true,
        actor_type: 'user',
        repeat_frequency: 'none',
        repeat_count: 1,
      })
      closeEventModal()
    } catch (error) {
      pushToast({ type: 'error', title: editingEvent ? 'No pudimos actualizar el evento' : 'No pudimos crear el evento', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function removeEvent(event: EventItem) {
    await deleteEvent(event.id)
    if (couple && profile) {
      void recordPartnerActivity({
        coupleId: couple.id,
        actorId: profile.id,
        targetUserId: partner?.id,
        module: 'calendar',
        action: 'deleted',
        entityType: 'event',
        entityId: event.id,
        title: event.title,
        body: 'Elimino un evento del calendario.',
        oldData: { ...event },
      })
    }
    pushToast({ type: 'success', title: 'Evento eliminado' })
  }

  async function saveEventStatus(event: EventItem, status: EventStatus, note?: string | null) {
    setBusy(true)
    try {
      const updated = await updateEventStatus(event.id, status, note)
      setEvents((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (couple && profile) {
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner?.id,
          module: 'calendar',
          action: 'status_changed',
          entityType: 'event',
          entityId: event.id,
          title: event.title,
          body: `Cambio el estado del evento a ${eventStatusMeta[status].label}.`,
          oldData: { ...event },
          newData: { ...updated },
        })
      }
      pushToast({ type: 'success', title: 'Estado actualizado' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos actualizar el estado', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  function handleStatusClick(event: EventItem, status: EventStatus) {
    if (status === 'not_done' || status === 'postponed') {
      setStatusTarget({ event, status })
      setStatusNote(event.status === status ? (event.status_note ?? '') : '')
      return
    }

    void saveEventStatus(event, status, null)
  }

  async function submitStatusNote() {
    if (!statusTarget) return
    const note = statusNote.trim()
    if (!note) {
      pushToast({ type: 'error', title: 'Agrega un detalle', description: 'Este estado necesita una razon para guardarse.' })
      return
    }

    await saveEventStatus(statusTarget.event, statusTarget.status, note)
    setStatusTarget(null)
    setStatusNote('')
  }

  function StatusBadge({ event }: { event: EventItem }) {
    const status = event.status ?? 'pending'
    const meta = eventStatusMeta[status]
    const Icon = meta.icon
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
        <Icon size={13} />
        {meta.label}
      </span>
    )
  }

  function StatusActions({ event }: { event: EventItem }) {
    return (
      <div className="flex flex-wrap gap-2">
        {statusActions.map((status) => {
          const meta = eventStatusMeta[status]
          const Icon = meta.icon
          const active = (event.status ?? 'pending') === status
          return (
            <button
              key={status}
              type="button"
              disabled={busy}
              className={[
                'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition disabled:opacity-50',
                active
                  ? meta.className
                  : 'bg-white/80 text-stone-600 hover:bg-blush-50 hover:text-blush-700 dark:bg-white/5 dark:text-stone-300 dark:hover:bg-white/10',
              ].join(' ')}
              onClick={() => handleStatusClick(event, status)}
            >
              <Icon size={14} />
              {meta.label}
            </button>
          )
        })}
      </div>
    )
  }

  function CompactEvent({ event }: { event: EventItem }) {
    const identity = eventIdentity(event)
    return (
      <button
        type="button"
        className="w-full rounded-2xl bg-blush-50/80 p-3 text-left transition hover:bg-blush-100 dark:bg-white/5 dark:hover:bg-white/10"
        onClick={() => {
          setSelectedDay(new Date(event.start_at))
          setCalendarView('day')
        }}
      >
        <div className="flex gap-2">
          <Avatar src={identity.src} name={identity.name} kind={identity.kind} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-950 dark:text-white">{event.title}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">{format(new Date(event.start_at), 'HH:mm')}</p>
            <div className="mt-2">
              <StatusBadge event={event} />
            </div>
          </div>
        </div>
      </button>
    )
  }

  function DetailedEvent({ event }: { event: EventItem }) {
    const identity = eventIdentity(event)
    return (
      <article className="grid gap-4 rounded-2xl bg-blush-50/80 p-4 dark:bg-white/5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="h-14 w-2 rounded-full" style={{ backgroundColor: event.color ?? '#ef9fb5' }} />
        <div>
          <div className="flex items-start gap-3">
            <Avatar src={identity.src} name={identity.name} kind={identity.kind} size="sm" />
            <div className="min-w-0">
              <h3 className="font-semibold text-stone-950 dark:text-white">{event.title}</h3>
              <p className="mt-1 text-xs font-medium text-blush-700 dark:text-blush-100">{identity.label}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge event={event} />
            <p className="text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
          </div>
          {event.location ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
              <MapPin size={14} />
              {event.location}
            </p>
          ) : null}
          {event.description ? <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{event.description}</p> : null}
          {event.status_note ? <p className="mt-2 rounded-2xl bg-white/70 p-3 text-sm text-stone-600 dark:bg-white/5 dark:text-stone-300">{event.status_note}</p> : null}
          <div className="mt-3">
            <StatusActions event={event} />
          </div>
        </div>
        <div className="flex gap-2 md:justify-end">
          <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => openEditEventModal(event)} aria-label="Editar evento">
            <Pencil size={17} />
          </Button>
          <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => void removeEvent(event)} aria-label="Eliminar evento">
            <Trash2 size={17} />
          </Button>
        </div>
      </article>
    )
  }

  const profilesById = useMemo(() => {
    const map = new Map<string, typeof profile>()
    if (profile) map.set(profile.id, profile)
    if (partner) map.set(partner.id, partner)
    return map
  }, [partner, profile])

  const now = useMemo(() => new Date(), [])
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    const monthEnd = endOfMonth(visibleMonth)
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    })
  }, [visibleMonth])
  const selectedDayEvents = useMemo(() => eventsForCalendarDay(events, selectedDay), [events, selectedDay])
  const selectedWeekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(selectedDay, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDay, { weekStartsOn: 1 }),
      }),
    [selectedDay],
  )
  const upcomingEvents = useMemo(() => events.filter((event) => new Date(event.start_at) >= now), [events, now])
  const memoryEvents = useMemo(
    () =>
      events
        .filter((event) => new Date(event.start_at) < now)
        .slice()
        .sort((left, right) => new Date(right.start_at).getTime() - new Date(left.start_at).getTime())
        .slice(0, 4),
    [events, now],
  )

  function eventIdentity(event: EventItem) {
    if ((event.actor_type ?? 'user') === 'couple') {
      return {
        src: couple?.avatar_url,
        name: 'Ambos',
        kind: 'couple' as const,
        label: 'Agregado por ambos',
      }
    }

    const author = profilesById.get(event.created_by)
    return {
      src: author?.avatar_url,
      name: author?.full_name ?? 'Usuario no disponible',
      kind: 'user' as const,
      label: author?.id === profile?.id ? 'Agregado por ti' : `Agregado por ${author?.full_name ?? 'Usuario no disponible'}`,
    }
  }

  function eventsForDay(day: Date) {
    return eventsForCalendarDay(events, day)
  }

  function eventsForHour(dayEvents: EventItem[], day: Date, hour: number) {
    const range = hourRange(day, hour)
    return dayEvents.filter((event) => overlaps(eventRange(event), range))
  }

  function openDay(day: Date) {
    setSelectedDay(day)
    setVisibleMonth(day)
    setCalendarView('day')
  }

  if (!hasCouple) {
    return (
      <EmptyState
        title="Vincula tu pareja para usar el calendario"
        description="El calendario compartido usa realtime y aparecerá para ambos en cuanto exista una pareja activa."
        actionLabel="Ir a pareja"
        onAction={() => navigate('/app/couple')}
      />
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Calendario</h1>
          <p className="mt-1 text-stone-600 dark:text-stone-300">Eventos compartidos sincronizados en tiempo real.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openEventModal}>
          Nuevo evento
        </Button>
      </div>

      <div className="flex rounded-2xl border border-white/70 bg-white/70 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:w-max">
        {[
          ['month', 'Mes'],
          ['week', 'Semana'],
          ['day', 'Dia'],
        ].map(([view, label]) => (
          <button
            key={view}
            type="button"
            className={[
              'min-h-10 rounded-2xl px-4 text-sm font-semibold transition',
              calendarView === view
                ? 'bg-blush-500 text-white shadow-soft dark:bg-blush-300 dark:text-blush-950'
                : 'text-stone-600 hover:bg-white/80 dark:text-stone-300 dark:hover:bg-white/10',
            ].join(' ')}
            onClick={() => setCalendarView(view as CalendarView)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <>
          {calendarView === 'month' ? (
          <article className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold capitalize text-stone-950 dark:text-white">
                  {format(visibleMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">Toca un dia para ver sus eventos.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="h-10 min-h-10 w-10 rounded-full px-0"
                  aria-label="Mes anterior"
                  onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="secondary" className="min-h-10 px-3 py-2" onClick={() => {
                  const today = new Date()
                  setVisibleMonth(today)
                  setSelectedDay(today)
                  setCalendarView('day')
                }}>
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 min-h-10 w-10 rounded-full px-0"
                  aria-label="Mes siguiente"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-stone-500 dark:text-stone-400 sm:gap-2">
              {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
              {monthDays.map((day) => {
                const dayEvents = eventsForDay(day)
                const selected = isSameDay(day, selectedDay)
                const inMonth = isSameMonth(day, visibleMonth)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={[
                      'flex aspect-square min-h-14 flex-col items-start justify-between rounded-2xl border p-2 text-left transition sm:min-h-20',
                      selected
                        ? 'border-blush-400 bg-blush-100 text-blush-900 shadow-soft dark:border-blush-300 dark:bg-blush-300/20 dark:text-white'
                        : 'border-white/70 bg-white/60 text-stone-800 hover:border-blush-200 hover:bg-blush-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-100 dark:hover:bg-white/10',
                      !inMonth && 'opacity-45',
                    ].join(' ')}
                    onClick={() => openDay(day)}
                  >
                    <span className="text-sm font-semibold">{format(day, 'd')}</span>
                    {dayEvents.length ? (
                      <span className="flex max-w-full gap-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: event.color ?? '#ef9fb5' }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </article>
          ) : null}

          {calendarView === 'week' ? (
            <article className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950 dark:text-white">
                    Semana del {format(selectedWeekDays[0], 'd MMM', { locale: es })} al {format(selectedWeekDays[6], 'd MMM', { locale: es })}
                  </h2>
                  <p className="text-sm text-stone-500 dark:text-stone-400">Desglose por horas de lunes a domingo.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => setSelectedDay((day) => new Date(day.getTime() - 7 * 24 * 60 * 60 * 1000))} aria-label="Semana anterior">
                    <ChevronLeft size={18} />
                  </Button>
                  <Button variant="secondary" className="min-h-10 px-3 py-2" onClick={() => setSelectedDay(new Date())}>
                    Hoy
                  </Button>
                  <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => setSelectedDay((day) => new Date(day.getTime() + 7 * 24 * 60 * 60 * 1000))} aria-label="Semana siguiente">
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto pb-2">
                <div className="grid min-w-[980px] grid-cols-7 gap-2">
                  {selectedWeekDays.map((day) => {
                    const dayEvents = eventsForDay(day)
                    return (
                      <div key={day.toISOString()} className="rounded-2xl border border-white/70 bg-white/50 p-2 dark:border-white/10 dark:bg-white/[0.03]">
                        <button
                          type="button"
                          className={[
                            'mb-2 w-full rounded-2xl px-3 py-2 text-left transition hover:bg-blush-50 dark:hover:bg-white/10',
                            isSameDay(day, selectedDay) && 'bg-blush-100 text-blush-900 dark:bg-blush-300/20 dark:text-white',
                          ].join(' ')}
                          onClick={() => setSelectedDay(day)}
                        >
                          <p className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">{format(day, 'EEE', { locale: es })}</p>
                          <p className="text-lg font-bold text-stone-950 dark:text-white">{format(day, 'd')}</p>
                        </button>
                        <div className="space-y-1">
                          {hourSlots.map((hour) => {
                            const hourEvents = eventsForHour(dayEvents, day, hour)
                            return (
                              <div key={hour} className="min-h-16 rounded-2xl bg-white/50 p-2 dark:bg-white/[0.03]">
                                <p className="text-[11px] font-semibold text-stone-400">{String(hour).padStart(2, '0')}:00</p>
                                <div className="mt-1 space-y-1">
                                  {hourEvents.map((event) => (
                                    <CompactEvent key={event.id} event={event} />
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </article>
          ) : null}

          {calendarView === 'day' ? (
          <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-950 dark:text-white">
                  {format(selectedDay, "d 'de' MMMM", { locale: es })}
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {selectedDayEvents.length ? `${selectedDayEvents.length} evento(s) este dia.` : 'No hay eventos para este dia.'}
                </p>
              </div>
              <Button variant="secondary" icon={<Plus size={17} />} onClick={openEventModal}>
                Agregar evento
              </Button>
            </div>

            <div className="mt-5 space-y-2">
              {hourSlots.map((hour) => {
                const hourEvents = eventsForHour(selectedDayEvents, selectedDay, hour)
                return (
                  <div key={hour} className="grid gap-3 rounded-2xl bg-white/55 p-3 dark:bg-white/[0.03] md:grid-cols-[76px_1fr]">
                    <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{String(hour).padStart(2, '0')}:00</p>
                    <div className="space-y-3">
                      {hourEvents.length ? hourEvents.map((event) => <DetailedEvent key={event.id} event={event} />) : (
                        <p className="rounded-2xl border border-dashed border-stone-200 p-3 text-sm text-stone-400 dark:border-white/10">
                          Sin actividad
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
          ) : null}

          {calendarView !== 'day' && selectedDayEvents.length ? (
            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">
                {format(selectedDay, "d 'de' MMMM", { locale: es })}
              </h2>
              <div className="mt-4 grid gap-3">
                {selectedDayEvents.map((event) => (
                  <DetailedEvent key={event.id} event={event} />
                ))}
              </div>
            </article>
          ) : null}

          {upcomingEvents.length ? (
            <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Proximos eventos</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {upcomingEvents.slice(0, 4).map((event) => {
                  const identity = eventIdentity(event)
                  return (
                    <div key={event.id} className="flex gap-3 rounded-2xl bg-white/70 p-4 dark:bg-white/5">
                      <Avatar src={identity.src} name={identity.name} kind={identity.kind} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-950 dark:text-white">{event.title}</p>
                        <p className="text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
                        <div className="mt-2">
                          <StatusBadge event={event} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          ) : (
            <EmptyState title="Sin eventos" description="Crea el primer evento compartido para que aparezca en el calendario de ambos." actionLabel="Nuevo evento" onAction={openEventModal} />
          )}
        </>
      )}

      {!loading && memoryEvents.length ? (
        <article className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="text-lg font-semibold text-stone-950 dark:text-white">Recuerdos recientes</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {memoryEvents.map((event) => {
              const identity = eventIdentity(event)
              return (
                <div key={event.id} className="flex gap-3 rounded-2xl bg-blush-50/80 p-4 dark:bg-white/5">
                  <Avatar src={identity.src} name={identity.name} kind={identity.kind} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-950 dark:text-white">{event.title}</p>
                    <p className="text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      ) : null}

      <Modal
        open={Boolean(statusTarget)}
        title={statusTarget?.status === 'postponed' ? 'Motivo del pospuesto' : 'Motivo de no realizado'}
        onClose={() => {
          setStatusTarget(null)
          setStatusNote('')
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {statusTarget?.status === 'postponed'
              ? 'CuÃ©ntense por quÃ© se pospuso este evento para que quede claro en la agenda.'
              : 'CuÃ©ntense por quÃ© no se realizÃ³ este evento para dejar contexto.'}
          </p>
          <Textarea
            label="Detalle"
            value={statusNote}
            onChange={(event) => setStatusNote(event.target.value)}
            placeholder={statusTarget?.status === 'postponed' ? 'Ej. Lo movimos por falta de tiempo...' : 'Ej. No pudimos ir porque...'}
          />
          <Button className="w-full" disabled={busy} onClick={() => void submitStatusNote()}>
            Guardar estado
          </Button>
        </div>
      </Modal>

      <Modal open={open} title={editingEvent ? 'Editar evento' : 'Nuevo evento'} onClose={closeEventModal}>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Título" error={errors.title?.message} {...register('title')} />
          <Textarea label="Descripción" error={errors.description?.message} {...register('description')} />
          <div className="rounded-2xl bg-blush-50/70 p-3 text-sm font-semibold text-blush-800 dark:bg-white/5 dark:text-blush-100">
            Fecha: {format(selectedDay, "d 'de' MMMM yyyy", { locale: es })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Hora inicio"
              type="time"
              error={errors.start_at?.message}
              value={timeFromDateTime(startAtField)}
              onChange={(event) => setValue('start_at', `${selectedDayValue()}T${event.target.value}`, { shouldValidate: true })}
            />
            <Input
              label="Hora fin"
              type="time"
              error={errors.end_at?.message}
              value={timeFromDateTime(endAtField)}
              onChange={(event) => setValue('end_at', `${selectedDayValue()}T${event.target.value}`, { shouldValidate: true })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Lugar" error={errors.location?.message} {...register('location')} />
            <Input label="Color" type="color" error={errors.color?.message} {...register('color')} />
          </div>
          <Select label="Autor visual" error={errors.actor_type?.message} {...register('actor_type')}>
            <option value="user">Lo agrego yo</option>
            <option value="couple">Lo agregamos ambos</option>
          </Select>
          {!editingEvent ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Repeticion" error={errors.repeat_frequency?.message} {...register('repeat_frequency')}>
                <option value="none">No repetir</option>
                <option value="weekly">Cada semana</option>
              </Select>
              {repeatFrequency === 'weekly' ? (
                <Input
                  label="Cantidad de semanas"
                  type="number"
                  min={1}
                  max={52}
                  error={errors.repeat_count?.message}
                  {...register('repeat_count', { valueAsNumber: true })}
                />
              ) : null}
            </div>
          ) : null}
          <label className="flex items-center gap-3 rounded-2xl bg-blush-50/70 p-3 text-sm font-medium text-stone-700 dark:bg-white/5 dark:text-stone-200">
            <input type="checkbox" className="h-4 w-4 accent-blush-500" {...register('is_shared')} />
            Compartido
          </label>
          <Button className="w-full" disabled={busy}>
            {editingEvent ? 'Guardar cambios' : 'Crear evento'}
          </Button>
        </form>
      </Modal>
    </section>
  )
}
