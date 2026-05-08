import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Textarea } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { eventSchema, type EventInput } from '../lib/validations/events'
import { createEvent, deleteEvent, listEvents, subscribeToEvents } from '../services/eventsService'
import { useToastStore } from '../store/toastStore'
import type { EventItem } from '../types/app'
import { formatDateTime } from '../utils/format'
import { useCoupleRequired } from '../hooks/useCoupleRequired'

export function CalendarPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile } = useCoupleRequired()
  const pushToast = useToastStore((state) => state.push)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
    mode: 'onChange',
    defaultValues: { is_shared: true, color: '#ef9fb5' },
  })

  useEffect(() => {
    if (!couple) return
    listEvents(couple.id)
      .then(setEvents)
      .finally(() => setLoading(false))
    return subscribeToEvents(couple.id, () => {
      void listEvents(couple.id).then(setEvents)
    })
  }, [couple])

  async function onSubmit(input: EventInput) {
    if (!couple || !profile) return
    setBusy(true)
    try {
      await createEvent(couple.id, profile.id, input)
      reset({ is_shared: true, color: '#ef9fb5' })
      setOpen(false)
      pushToast({ type: 'success', title: 'Evento creado' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos crear el evento', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function removeEvent(event: EventItem) {
    await deleteEvent(event.id)
    pushToast({ type: 'success', title: 'Evento eliminado' })
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
        <Button icon={<Plus size={18} />} onClick={() => setOpen(true)}>
          Nuevo evento
        </Button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : events.length ? (
        <div className="grid gap-3">
          {events.map((event) => (
            <article key={event.id} className="grid gap-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-[auto_1fr_auto] md:items-center">
              <div className="h-14 w-2 rounded-full" style={{ backgroundColor: event.color ?? '#ef9fb5' }} />
              <div>
                <h2 className="font-semibold text-stone-950 dark:text-white">{event.title}</h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{formatDateTime(event.start_at)}</p>
                {event.location ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                    <MapPin size={14} />
                    {event.location}
                  </p>
                ) : null}
                {event.description ? <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{event.description}</p> : null}
              </div>
              <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => void removeEvent(event)} aria-label="Eliminar evento">
                <Trash2 size={17} />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin eventos" description="Crea el primer evento compartido para que aparezca en el calendario de ambos." actionLabel="Nuevo evento" onAction={() => setOpen(true)} />
      )}

      <Modal open={open} title="Nuevo evento" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Título" error={errors.title?.message} {...register('title')} />
          <Textarea label="Descripción" error={errors.description?.message} {...register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Inicio" type="datetime-local" error={errors.start_at?.message} {...register('start_at')} />
            <Input label="Fin" type="datetime-local" error={errors.end_at?.message} {...register('end_at')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Lugar" error={errors.location?.message} {...register('location')} />
            <Input label="Color" type="color" error={errors.color?.message} {...register('color')} />
          </div>
          <label className="flex items-center gap-3 rounded-2xl bg-blush-50/70 p-3 text-sm font-medium text-stone-700 dark:bg-white/5 dark:text-stone-200">
            <input type="checkbox" className="h-4 w-4 accent-blush-500" {...register('is_shared')} />
            Compartido
          </label>
          <Button className="w-full" disabled={busy}>
            Crear evento
          </Button>
        </form>
      </Modal>
    </section>
  )
}
