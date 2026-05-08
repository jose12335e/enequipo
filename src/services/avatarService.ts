import { supabase } from '../lib/supabase'

const AVATAR_BUCKET = 'avatars'
const MAX_IMAGE_SIZE = 640
const IMAGE_QUALITY = 0.82
const MAX_SOURCE_BYTES = 8 * 1024 * 1024

async function resizeToWebp(file: File): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('La imagen es muy pesada. Usa una foto menor a 8 MB.')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('No pudimos procesar la imagen.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No pudimos preparar la imagen.'))
      },
      'image/webp',
      IMAGE_QUALITY,
    )
  })
}

async function uploadAvatar(path: string, file: File) {
  const optimized = await resizeToWebp(file)
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, optimized, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export function uploadUserAvatar(userId: string, file: File) {
  return uploadAvatar(`users/${userId}/profile.webp`, file)
}

export function uploadCoupleAvatar(coupleId: string, file: File) {
  return uploadAvatar(`couples/${coupleId}/couple.webp`, file)
}
