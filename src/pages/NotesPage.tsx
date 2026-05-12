import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input, Textarea } from '../components/Input'
import { Modal } from '../components/Modal'
import { ListSkeleton } from '../components/Skeleton'
import { noteSchema, type NoteInput } from '../lib/validations/notes'
import { recordPartnerActivity } from '../services/activityNotificationsService'
import { createNote, deleteNote, listNotes, updateNote } from '../services/notesService'
import { useToastStore } from '../store/toastStore'
import type { Note } from '../types/app'
import { formatDate } from '../utils/format'
import { useCoupleRequired } from '../hooks/useCoupleRequired'
import { markModuleActivitySeen, noteActivity } from '../utils/activity'

export function NotesPage() {
  const navigate = useNavigate()
  const { hasCouple, couple, profile, partner } = useCoupleRequired()
  const pushToast = useToastStore((state) => state.push)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<NoteInput>({ resolver: zodResolver(noteSchema), mode: 'onChange', defaultValues: { is_shared: false } })

  useEffect(() => {
    if (!couple) return
    listNotes(couple.id)
      .then((rows) => {
        setNotes(rows)
        if (profile) markModuleActivitySeen(profile.id, 'notes', rows.map(noteActivity))
      })
      .finally(() => setLoading(false))
  }, [couple, profile])

  async function refresh() {
    if (!couple) return
    const rows = await listNotes(couple.id)
    setNotes(rows)
    if (profile) markModuleActivitySeen(profile.id, 'notes', rows.map(noteActivity))
  }

  function openNoteModal() {
    setEditingNote(null)
    reset({ title: '', content: '', category: '', is_shared: false })
    setOpen(true)
  }

  function openEditNoteModal(note: Note) {
    setEditingNote(note)
    reset({
      title: note.title,
      content: note.content,
      category: note.category ?? '',
      is_shared: note.is_shared,
    })
    setOpen(true)
  }

  function closeNoteModal() {
    setOpen(false)
    setEditingNote(null)
  }

  async function onSubmit(input: NoteInput) {
    if (!couple || !profile) return
    setBusy(true)
    try {
      if (editingNote) {
        const updated = await updateNote(editingNote.id, input)
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner?.id,
          module: 'notes',
          action: 'updated',
          entityType: 'note',
          entityId: updated.id,
          title: updated.title,
          body: 'Edito una nota.',
          oldData: { ...editingNote },
          newData: { ...updated },
        })
      } else {
        const created = await createNote(couple.id, profile.id, input)
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner?.id,
          module: 'notes',
          action: 'created',
          entityType: 'note',
          entityId: created.id,
          title: created.title,
          body: 'Agrego una nota.',
          newData: { ...created },
        })
      }
      await refresh()
      reset({ title: '', content: '', category: '', is_shared: false })
      closeNoteModal()
      pushToast({ type: 'success', title: editingNote ? 'Nota actualizada' : 'Nota creada' })
    } catch (error) {
      pushToast({ type: 'error', title: editingNote ? 'No pudimos actualizar la nota' : 'No pudimos crear la nota', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function removeNote(note: Note) {
    await deleteNote(note.id)
    if (couple && profile) {
      void recordPartnerActivity({
        coupleId: couple.id,
        actorId: profile.id,
        targetUserId: partner?.id,
        module: 'notes',
        action: 'deleted',
        entityType: 'note',
        entityId: note.id,
        title: note.title,
        body: 'Elimino una nota.',
        oldData: { ...note },
      })
    }
    await refresh()
    pushToast({ type: 'success', title: 'Nota eliminada' })
  }

  if (!hasCouple) {
    return (
      <EmptyState
        title="Vincula tu pareja para usar notas"
        description="Las notas se refrescan al entrar al módulo y no usan realtime, tal como se definió."
        actionLabel="Ir a pareja"
        onAction={() => navigate('/app/couple')}
      />
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Notas</h1>
          <p className="mt-1 text-stone-600 dark:text-stone-300">Ideas, listas y acuerdos sin ruido realtime.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openNoteModal}>
          Nueva nota
        </Button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : notes.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {notes.map((note) => (
            <article key={note.id} className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-stone-950 dark:text-white">{note.title}</h2>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {note.category || 'General'} · {note.is_shared ? 'Compartida' : 'Privada'} · {formatDate(note.updated_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="h-9 min-h-9 w-9 rounded-full px-0" onClick={() => openEditNoteModal(note)} aria-label="Editar nota">
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" className="h-9 min-h-9 w-9 rounded-full px-0" onClick={() => void removeNote(note)} aria-label="Eliminar nota">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <p className="mt-4 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-stone-600 dark:text-stone-300">{note.content}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin notas" description="Guarda una nota para la pareja o mantenla privada dentro del espacio compartido." actionLabel="Nueva nota" onAction={openNoteModal} />
      )}

      <Modal open={open} title={editingNote ? 'Editar nota' : 'Nueva nota'} onClose={closeNoteModal}>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Título" error={errors.title?.message} {...register('title')} />
          <Textarea label="Contenido" error={errors.content?.message} {...register('content')} />
          <Input label="Categoría" error={errors.category?.message} {...register('category')} />
          <label className="flex items-center gap-3 rounded-2xl bg-blush-50/70 p-3 text-sm font-medium text-stone-700 dark:bg-white/5 dark:text-stone-200">
            <input type="checkbox" className="h-4 w-4 accent-blush-500" {...register('is_shared')} />
            Compartida con mi pareja
          </label>
          <Button className="w-full" disabled={busy}>
            {editingNote ? 'Guardar cambios' : 'Crear nota'}
          </Button>
        </form>
      </Modal>
    </section>
  )
}
