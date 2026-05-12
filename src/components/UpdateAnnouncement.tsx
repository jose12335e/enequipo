import { Bell, Check, EyeOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { markReleaseNotesRead, markReleaseRead, listUnreadReleaseNotes } from '../services/releaseNotesService'
import { useAuthStore } from '../store/authStore'
import type { ReleaseNote } from '../types/app'

export function UpdateAnnouncement() {
  const profile = useAuthStore((state) => state.profile)
  const [hiddenReleaseIds, setHiddenReleaseIds] = useState<string[]>([])
  const [unread, setUnread] = useState<ReleaseNote[]>([])

  useEffect(() => {
    if (!profile) return

    let active = true
    void listUnreadReleaseNotes(profile.id)
      .then((releases) => {
        if (active) setUnread(releases)
      })
      .catch((error) => {
        console.warn('DuoLife release notes skipped', error)
      })

    return () => {
      active = false
    }
  }, [profile])

  const visibleUnread = unread.filter((release) => !hiddenReleaseIds.includes(release.id))
  const visible = visibleUnread.length > 0

  if (!profile || !visible) return null

  function hideForNow() {
    setHiddenReleaseIds((current) => [...new Set([...current, ...visibleUnread.map((release) => release.id)])])
  }

  function markAllAsRead() {
    if (!profile) return
    void markReleaseNotesRead(profile.id, visibleUnread)
      .then(() => {
        setUnread((current) => current.filter((release) => !visibleUnread.some((visibleRelease) => visibleRelease.id === release.id)))
        hideForNow()
      })
      .catch((error) => console.warn('DuoLife release notes read skipped', error))
  }

  function markOneAsRead(releaseId: string) {
    if (!profile) return
    void markReleaseRead(profile.id, releaseId)
      .then(() => {
        setUnread((current) => current.filter((release) => release.id !== releaseId))
        setHiddenReleaseIds((current) => [...new Set([...current, releaseId])])
      })
      .catch((error) => console.warn('DuoLife release note read skipped', error))
  }

  return (
    <section
      aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-blush-200/80 bg-white p-4 shadow-2xl shadow-blush-900/15 transition dark:border-white/10 dark:bg-stone-950 md:bottom-6 md:left-auto md:right-6 md:w-[460px]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blush-100 text-blush-700 dark:bg-blush-400/15 dark:text-blush-200">
          <Bell size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blush-600 dark:text-blush-200">Novedades</p>
          <h2 className="mt-1 text-lg font-bold text-stone-950 dark:text-white">
            {visibleUnread.length === 1 ? 'Tienes 1 novedad pendiente' : `Tienes ${visibleUnread.length} novedades pendientes`}
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Cada persona marca sus novedades como leidas por separado.</p>
        </div>
        <button
          type="button"
          onClick={hideForNow}
          className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Cerrar por ahora"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {visibleUnread.map((release) => (
          <article key={release.id} className="rounded-2xl bg-blush-50/80 p-3 dark:bg-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-stone-950 dark:text-white">{release.title}</h3>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{release.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => markOneAsRead(release.id)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-blush-700 transition hover:bg-white dark:text-blush-100 dark:hover:bg-white/10"
              >
                Leido
              </button>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-stone-700 dark:text-stone-300">
              {release.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blush-400" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={markAllAsRead}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-200 dark:hover:bg-white/10"
        >
          <EyeOff size={16} />
          No volver a mostrar
        </button>
        <button
          type="button"
          onClick={markAllAsRead}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blush-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blush-500/20 transition hover:bg-blush-600"
        >
          <Check size={16} />
          Leido
        </button>
      </div>
    </section>
  )
}
