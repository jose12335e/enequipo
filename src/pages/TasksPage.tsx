import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Select, Textarea } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { taskSchema, type TaskInput } from '../lib/validations/tasks'
import { createTask, deleteTask, listTasks, subscribeToTasks, updateTask } from '../services/tasksService'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import type { TaskItem, UserProfile } from '../types/app'
import { cn } from '../utils/cn'
import { formatDate } from '../utils/format'
import { useCoupleRequired } from '../hooks/useCoupleRequired'

function assigneeLabel(task: TaskItem, profile: UserProfile | null, partner: UserProfile | null) {
  if (!task.assigned_to) return 'Sin asignar'
  if (task.assigned_to === profile?.id) return profile.full_name ?? 'Tú'
  if (task.assigned_to === partner?.id) return partner.full_name ?? 'Tu pareja'
  return 'Usuario no disponible'
}

export function TasksPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile, partner } = useCoupleRequired()
  const refreshContext = useAuthStore((state) => state.refreshContext)
  const pushToast = useToastStore((state) => state.push)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    mode: 'onChange',
    defaultValues: { priority: 'medium', status: 'pending' },
  })

  const members = useMemo(() => [profile, partner].filter(Boolean) as UserProfile[], [partner, profile])

  useEffect(() => {
    if (!couple) return
    listTasks(couple.id)
      .then(setTasks)
      .finally(() => setLoading(false))
    return subscribeToTasks(couple.id, () => {
      void listTasks(couple.id).then(setTasks)
    })
  }, [couple])

  async function onSubmit(input: TaskInput) {
    if (!couple || !profile) return
    setBusy(true)
    try {
      await createTask(couple.id, profile.id, input)
      reset({ priority: 'medium', status: 'pending' })
      setOpen(false)
      await refreshContext()
      pushToast({ type: 'success', title: 'Tarea creada' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos crear la tarea', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function markDone(task: TaskItem) {
    await updateTask(task.id, { status: task.status === 'done' ? 'pending' : 'done' })
    pushToast({ type: 'success', title: task.status === 'done' ? 'Tarea reabierta' : 'Tarea completada' })
  }

  async function removeTask(task: TaskItem) {
    await deleteTask(task.id)
    pushToast({ type: 'success', title: 'Tarea eliminada' })
  }

  if (!hasCouple) {
    return (
      <EmptyState
        title="Vincula tu pareja para compartir tareas"
        description="Las tareas pertenecen a la pareja. Sin couple_id no se permite crear tareas compartidas."
        actionLabel="Ir a pareja"
        onAction={() => navigate('/app/couple')}
      />
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Tareas</h1>
          <p className="mt-1 text-stone-600 dark:text-stone-300">Pendientes, responsables y prioridades compartidas.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setOpen(true)}>
          Nueva tarea
        </Button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : tasks.length ? (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <article key={task.id} className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={cn('font-semibold text-stone-950 dark:text-white', task.status === 'done' && 'text-stone-400 line-through')}>{task.title}</h2>
                  <span className="rounded-full bg-lavender-100 px-2.5 py-1 text-xs font-semibold text-lavender-700 dark:bg-lavender-900/40 dark:text-lavender-100">{task.priority ?? 'medium'}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{task.description || 'Sin descripción'}</p>
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                  {assigneeLabel(task, profile, partner)} · {formatDate(task.due_date)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => void markDone(task)} aria-label="Cambiar estado">
                  <Check size={17} />
                </Button>
                <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => void removeTask(task)} aria-label="Eliminar tarea">
                  <Trash2 size={17} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin tareas" description="Crea la primera tarea compartida y asígnala a quien corresponda." actionLabel="Nueva tarea" onAction={() => setOpen(true)} />
      )}

      <Modal open={open} title="Nueva tarea" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Título" error={errors.title?.message} {...register('title')} />
          <Textarea label="Descripción" error={errors.description?.message} {...register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Prioridad" error={errors.priority?.message} {...register('priority')}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </Select>
            <Select label="Estado" error={errors.status?.message} {...register('status')}>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En progreso</option>
              <option value="done">Lista</option>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Fecha límite" type="date" error={errors.due_date?.message} {...register('due_date')} />
            <Select label="Asignada a" error={errors.assigned_to?.message} {...register('assigned_to')}>
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name ?? (member.id === profile?.id ? 'Tú' : 'Tu pareja')}
                </option>
              ))}
            </Select>
          </div>
          <Button className="w-full" disabled={busy}>
            Crear tarea
          </Button>
        </form>
      </Modal>
    </section>
  )
}
