import { Bell, Check, EyeOff, X } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { currentReleaseNote, hasReadCurrentRelease, markCurrentReleaseRead } from '../utils/releaseNotes'

export function UpdateAnnouncement() {
  const profile = useAuthStore((state) => state.profile)
  const [hiddenReleaseId, setHiddenReleaseId] = useState<string | null>(null)

  const visible = Boolean(profile && hiddenReleaseId !== currentReleaseNote.id && !hasReadCurrentRelease(profile.id))

  if (!profile || !visible) return null

  function markAsRead() {
    if (!profile) return
    markCurrentReleaseRead(profile.id)
    setHiddenReleaseId(currentReleaseNote.id)
  }

  return (
    <section
      aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-blush-200/80 bg-white p-4 shadow-2xl shadow-blush-900/15 transition dark:border-white/10 dark:bg-stone-950 md:bottom-6 md:left-auto md:right-6 md:w-[420px]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blush-100 text-blush-700 dark:bg-blush-400/15 dark:text-blush-200">
          <Bell size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blush-600 dark:text-blush-200">Actualizacion</p>
          <h2 className="mt-1 text-lg font-bold text-stone-950 dark:text-white">{currentReleaseNote.title}</h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{currentReleaseNote.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setHiddenReleaseId(currentReleaseNote.id)}
          className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Cerrar por ahora"
        >
          <X size={18} />
        </button>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-stone-700 dark:text-stone-300">
        {currentReleaseNote.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blush-400" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={markAsRead}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-200 dark:hover:bg-white/10"
        >
          <EyeOff size={16} />
          No volver a mostrar
        </button>
        <button
          type="button"
          onClick={markAsRead}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blush-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blush-500/20 transition hover:bg-blush-600"
        >
          <Check size={16} />
          Leido
        </button>
      </div>
    </section>
  )
}
