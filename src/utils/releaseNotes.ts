export interface ReleaseNote {
  id: string
  title: string
  summary: string
  highlights: string[]
}

export const currentReleaseNote: ReleaseNote = {
  id: '2026-05-12-agenda-alerts',
  title: 'Novedades en agenda y seguimiento',
  summary: 'DuoLife ahora avisa mejor cuando hay cambios importantes para la pareja.',
  highlights: [
    'Inicio muestra avisos cuando tu pareja agrega algo nuevo.',
    'Los eventos vencidos pendientes piden confirmar si se realizaron.',
    'Puedes definir un color predeterminado para eventos desde Perfil.',
  ],
}

function releaseKey(userId: string) {
  return `doulife:release-note:${userId}:${currentReleaseNote.id}`
}

export function hasReadCurrentRelease(userId: string) {
  return localStorage.getItem(releaseKey(userId)) === 'read'
}

export function markCurrentReleaseRead(userId: string) {
  localStorage.setItem(releaseKey(userId), 'read')
}
