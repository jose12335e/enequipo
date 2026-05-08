import { Camera, HeartHandshake, LogOut, Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { uploadCoupleAvatar, uploadUserAvatar } from '../services/avatarService'
import { signOut, updateProfile } from '../services/authService'
import { updateCoupleAvatar } from '../services/coupleService'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

interface ProfileForm {
  full_name: string
}

export function ProfilePage() {
  const profile = useAuthStore((state) => state.profile)
  const partner = useAuthStore((state) => state.partner)
  const couple = useAuthStore((state) => state.couple)
  const refreshContext = useAuthStore((state) => state.refreshContext)
  const pushToast = useToastStore((state) => state.push)
  const [busy, setBusy] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCoupleAvatar, setUploadingCoupleAvatar] = useState(false)
  const { register, handleSubmit } = useForm<ProfileForm>({
    values: {
      full_name: profile?.full_name ?? '',
    },
  })

  async function onSubmit(values: ProfileForm) {
    if (!profile) return
    setBusy(true)
    try {
      await updateProfile(profile.id, { full_name: values.full_name, avatar_url: profile.avatar_url })
      await refreshContext()
      pushToast({ type: 'success', title: 'Perfil actualizado' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos guardar', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function handleAvatarChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!profile || !file) return
    if (!file.type.startsWith('image/')) {
      pushToast({ type: 'error', title: 'Archivo invalido', description: 'Selecciona una imagen.' })
      return
    }

    setUploadingAvatar(true)
    try {
      const avatarUrl = await uploadUserAvatar(profile.id, file)
      await updateProfile(profile.id, { full_name: profile.full_name, avatar_url: avatarUrl })
      await refreshContext()
      pushToast({ type: 'success', title: 'Foto actualizada' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos subir la foto', description: (error as Error).message })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCoupleAvatarChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!couple || !file) return
    if (!file.type.startsWith('image/')) {
      pushToast({ type: 'error', title: 'Archivo invalido', description: 'Selecciona una imagen.' })
      return
    }

    setUploadingCoupleAvatar(true)
    try {
      const avatarUrl = await uploadCoupleAvatar(couple.id, file)
      await updateCoupleAvatar(couple.id, avatarUrl)
      await refreshContext()
      pushToast({ type: 'success', title: 'Foto de pareja actualizada' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos subir la foto', description: (error as Error).message })
    } finally {
      setUploadingCoupleAvatar(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Perfil</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-300">
          {partner ? `Compartes DuoLife con ${partner.full_name ?? 'tu pareja'}` : 'Sin pareja vinculada. Puedes crear o unirte desde Pareja.'}
        </p>
      </div>

      <form
        className="grid gap-5 rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:max-w-4xl"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
            <div>
              <p className="font-semibold text-stone-950 dark:text-white">Foto individual</p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blush-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-blush-800 transition hover:bg-blush-50 dark:border-white/10 dark:bg-white/5 dark:text-blush-100 dark:hover:bg-white/10">
                <Camera size={17} />
                {uploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={(event) => void handleAvatarChange(event.target.files)}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar src={couple?.avatar_url} kind="couple" name={partner?.full_name ?? 'Pareja'} size="lg" />
            <div>
              <p className="font-semibold text-stone-950 dark:text-white">Foto de pareja</p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blush-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-blush-800 transition hover:bg-blush-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-blush-100 dark:hover:bg-white/10">
                <Camera size={17} />
                {uploadingCoupleAvatar ? 'Subiendo...' : 'Cambiar foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={!couple || uploadingCoupleAvatar}
                  onChange={(event) => void handleCoupleAvatarChange(event.target.files)}
                />
              </label>
            </div>
          </div>
        </div>

        <Input label="Nombre completo" {...register('full_name')} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button icon={<Save size={17} />} disabled={busy}>
            Guardar
          </Button>
          <Link
            to="/app/couple"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-blush-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-blush-800 transition hover:bg-blush-50 focus:outline-none focus:ring-2 focus:ring-blush-300 dark:border-white/10 dark:bg-white/5 dark:text-blush-100 dark:hover:bg-white/10"
          >
            <HeartHandshake size={17} />
            Gestionar pareja
          </Link>
          <Button type="button" variant="secondary" icon={<LogOut size={17} />} onClick={() => void signOut()}>
            Cerrar sesion
          </Button>
        </div>
      </form>
    </section>
  )
}
