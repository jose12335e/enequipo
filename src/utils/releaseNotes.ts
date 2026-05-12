export interface ReleaseNote {
  id: string
  title: string
  summary: string
  highlights: string[]
}

export const releaseNotes: ReleaseNote[] = [
  {
    id: '2026-05-12-agenda-alerts',
    title: 'Novedades en agenda y seguimiento',
    summary: 'DuoLife ahora avisa mejor cuando hay cambios importantes para la pareja.',
    highlights: [
      'Inicio muestra avisos cuando tu pareja agrega algo nuevo.',
      'Los eventos vencidos pendientes piden confirmar si se realizaron.',
      'Puedes definir un color predeterminado para eventos desde Perfil.',
    ],
  },
  {
    id: '2026-05-12-release-inbox',
    title: 'Centro de novedades no leidas',
    summary: 'Las actualizaciones ahora se guardan por usuario hasta que cada persona las marque como leidas.',
    highlights: [
      'Si se publican varias mejoras en un dia, se muestran todas las no vistas.',
      'Cada usuario confirma sus novedades de forma independiente.',
      'Las tareas pueden quedar asignadas a ambos cuando son responsabilidad compartida.',
    ],
  },
]

function releaseKey(userId: string, releaseId: string) {
  return `doulife:release-note:${userId}:${releaseId}`
}

export function hasReadRelease(userId: string, releaseId: string) {
  return localStorage.getItem(releaseKey(userId, releaseId)) === 'read'
}

export function unreadReleaseNotes(userId: string) {
  return releaseNotes.filter((release) => !hasReadRelease(userId, release.id))
}

export function markReleaseRead(userId: string, releaseId: string) {
  localStorage.setItem(releaseKey(userId, releaseId), 'read')
}

export function markReleaseNotesRead(userId: string, releases: Pick<ReleaseNote, 'id'>[]) {
  for (const release of releases) markReleaseRead(userId, release.id)
}
