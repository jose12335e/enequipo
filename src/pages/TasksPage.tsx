import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Clock3, ListTodo, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Select, Textarea } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { useCoupleRequired } from '../hooks/useCoupleRequired'
import { taskSchema, type TaskInput } from '../lib/validations/tasks'
import { createTask, deleteTask, listTasks, subscribeToTasks, updateTask, updateTaskStatus } from '../services/tasksService'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import type { TaskItem, TaskStatus, UserProfile } from '../types/app'
import { cn } from '../utils/cn'
import { formatDate } from '../utils/format'
import { markModuleActivitySeen, taskActivity } from '../utils/activity'

const taskStatusMeta: Record<TaskStatus, { label: string; className: string; cardClassName: string; icon: typeof Clock3 }> = {
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-300/15 dark:text-amber-100',
    cardClassName: 'border-amber-200 bg-amber-50/75 dark:border-amber-300/20 dark:bg-amber-300/10',
    icon: Clock3,
  },
  in_progress: {
    label: 'En progreso',
    className: 'bg-lavender-100 text-lavender-800 dark:bg-lavender-300/15 dark:text-lavender-100',
    cardClassName: 'border-lavender-200 bg-lavender-50/75 dark:border-lavender-300/20 dark:bg-lavender-300/10',
    icon: ListTodo,
  },
  done: {
    label: 'Hecha',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/15 dark:text-emerald-100',
    cardClassName: 'border-emerald-200 bg-emerald-50/75 dark:border-emerald-300/20 dark:bg-emerald-300/10',
    icon: CheckCircle2,
  },
  not_done: {
    label: 'No realizada',
    className: 'bg-red-100 text-red-800 dark:bg-red-300/15 dark:text-red-100',
    cardClassName: 'border-red-200 bg-red-50/75 dark:border-red-300/20 dark:bg-red-300/10',
    icon: XCircle,
  },
  postponed: {
    label: 'Pospuesta',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-300/15 dark:text-sky-100',
    cardClassName: 'border-sky-200 bg-sky-50/75 dark:border-sky-300/20 dark:bg-sky-300/10',
    icon: RotateCcw,
  },
}

const taskStatusActions: TaskStatus[] = ['pending', 'in_progress', 'done', 'not_done', 'postponed']

function assigneeLabel(task: TaskItem, profile: UserProfile | null, partner: UserProfile | null) {
  if (!task.assigned_to) return 'Sin asignar'
  if (task.assigned_to === profile?.id) return profile.full_name ?? 'Tu'
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
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ task: TaskItem; status: TaskStatus } | null>(null)
  const [statusNote, setStatusNote] = useState('')
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

  function openTaskModal() {
    setEditingTask(null)
    reset({ title: '', description: '', priority: 'medium', status: 'pending', due_date: '', assigned_to: '' })
    setOpen(true)
  }

  function openEditTaskModal(task: TaskItem) {
    setEditingTask(task)
    reset({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority ?? 'medium',
      status: task.status,
      due_date: task.due_date ?? '',
      assigned_to: task.assigned_to ?? '',
    })
    setOpen(true)
  }

  function closeTaskModal() {
    setOpen(false)
    setEditingTask(null)
  }

  useEffect(() => {
    if (!couple) return
    listTasks(couple.id)
      .then((rows) => {
        setTasks(rows)
        if (profile) markModuleActivitySeen(profile.id, 'tasks', rows.map(taskActivity))
      })
      .finally(() => setLoading(false))
    return subscribeToTasks(couple.id, () => {
      void listTasks(couple.id).then((rows) => {
        setTasks(rows)
        if (profile) markModuleActivitySeen(profile.id, 'tasks', rows.map(taskActivity))
      })
    })
  }, [couple, profile])

  async function onSubmit(input: TaskInput) {
    if (!couple || !profile) return
    setBusy(true)
    try {
      if (editingTask) {
        const updated = await updateTask(editingTask.id, input)
        setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)))
        pushToast({ type: 'success', title: 'Tarea actualizada' })
      } else {
        await createTask(couple.id, profile.id, input)
        pushToast({ type: 'success', title: 'Tarea creada' })
      }
      reset({ title: '', description: '', priority: 'medium', status: 'pending', due_date: '', assigned_to: '' })
      closeTaskModal()
      await refreshContext()
    } catch (error) {
      pushToast({ type: 'error', title: editingTask ? 'No pudimos actualizar la tarea' : 'No pudimos crear la tarea', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function saveTaskStatus(task: TaskItem, status: TaskStatus, note?: string | null) {
    setBusy(true)
    try {
      const updated = await updateTaskStatus(task.id, status, note)
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      pushToast({ type: 'success', title: 'Estado actualizado' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos actualizar la tarea', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  function handleStatusClick(task: TaskItem, status: TaskStatus) {
    if (status === 'not_done' || status === 'postponed') {
      setStatusTarget({ task, status })
      setStatusNote(task.status === status ? (task.status_note ?? '') : '')
      return
    }

    void saveTaskStatus(task, status, null)
  }

  async function submitStatusNote() {
    if (!statusTarget) return
    const note = statusNote.trim()
    if (!note) {
      pushToast({ type: 'error', title: 'Agrega un detalle', description: 'Este estado necesita una razon para guardarse.' })
      return
    }

    await saveTaskStatus(statusTarget.task, statusTarget.status, note)
    setStatusTarget(null)
    setStatusNote('')
  }

  async function removeTask(task: TaskItem) {
    await deleteTask(task.id)
    pushToast({ type: 'success', title: 'Tarea eliminada' })
  }

  function TaskStatusBadge({ task }: { task: TaskItem }) {
    const meta = taskStatusMeta[task.status]
    const Icon = meta.icon
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
        <Icon size={13} />
        {meta.label}
      </span>
    )
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
          <p className="mt-1 text-stone-600 dark:text-stone-300">Responsables, estados y prioridades compartidas.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openTaskModal}>
          Nueva tarea
        </Button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : tasks.length ? (
        <div className="grid gap-3">
          {tasks.map((task) => {
            const statusMeta = taskStatusMeta[task.status]
            return (
              <article key={task.id} className={cn('flex flex-col gap-4 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between', statusMeta.cardClassName)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={cn('font-semibold text-stone-950 dark:text-white', task.status === 'done' && 'text-stone-400 line-through')}>{task.title}</h2>
                    <span className="rounded-full bg-lavender-100 px-2.5 py-1 text-xs font-semibold text-lavender-700 dark:bg-lavender-900/40 dark:text-lavender-100">{task.priority ?? 'medium'}</span>
                    <TaskStatusBadge task={task} />
                  </div>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{task.description || 'Sin descripcion'}</p>
                  {task.status_note ? <p className="mt-2 rounded-2xl bg-white/70 p-3 text-sm text-stone-600 dark:bg-white/5 dark:text-stone-300">{task.status_note}</p> : null}
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    {assigneeLabel(task, profile, partner)} - {formatDate(task.due_date)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {taskStatusActions.map((status) => {
                      const meta = taskStatusMeta[status]
                      const Icon = meta.icon
                      const active = task.status === status
                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={busy}
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition disabled:opacity-50',
                            active ? meta.className : 'bg-white/80 text-stone-600 hover:bg-blush-50 hover:text-blush-700 dark:bg-white/5 dark:text-stone-300 dark:hover:bg-white/10',
                          )}
                          onClick={() => handleStatusClick(task, status)}
                        >
                          <Icon size={14} />
                          {meta.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => openEditTaskModal(task)} aria-label="Editar tarea">
                    <Pencil size={17} />
                  </Button>
                  <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={() => void removeTask(task)} aria-label="Eliminar tarea">
                    <Trash2 size={17} />
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState title="Sin tareas" description="Crea la primera tarea compartida y asignala a quien corresponda." actionLabel="Nueva tarea" onAction={openTaskModal} />
      )}

      <Modal
        open={Boolean(statusTarget)}
        title={statusTarget?.status === 'postponed' ? 'Motivo de posponer' : 'Motivo de no realizar'}
        onClose={() => {
          setStatusTarget(null)
          setStatusNote('')
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {statusTarget?.status === 'postponed'
              ? 'Escribe por que esta tarea se pospuso para que ambos tengan contexto.'
              : 'Escribe por que esta tarea no se realizo.'}
          </p>
          <Textarea
            label="Detalle"
            value={statusNote}
            onChange={(event) => setStatusNote(event.target.value)}
            placeholder={statusTarget?.status === 'postponed' ? 'Ej. La movimos para manana...' : 'Ej. No se pudo porque...'}
          />
          <Button className="w-full" disabled={busy} onClick={() => void submitStatusNote()}>
            Guardar estado
          </Button>
        </div>
      </Modal>

      <Modal open={open} title={editingTask ? 'Editar tarea' : 'Nueva tarea'} onClose={closeTaskModal}>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Titulo" error={errors.title?.message} {...register('title')} />
          <Textarea label="Descripcion" error={errors.description?.message} {...register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Prioridad" error={errors.priority?.message} {...register('priority')}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </Select>
            <Select label="Estado" error={errors.status?.message} {...register('status')}>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En progreso</option>
              <option value="done">Hecha</option>
              <option value="not_done">No realizada</option>
              <option value="postponed">Pospuesta</option>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Fecha limite" type="date" error={errors.due_date?.message} {...register('due_date')} />
            <Select label="Asignada a" error={errors.assigned_to?.message} {...register('assigned_to')}>
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name ?? (member.id === profile?.id ? 'Tu' : 'Tu pareja')}
                </option>
              ))}
            </Select>
          </div>
          <Button className="w-full" disabled={busy}>
            {editingTask ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
        </form>
      </Modal>
    </section>
  )
}
