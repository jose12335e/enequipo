import { HeartHandshake, LogOut, Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { signOut, updateProfile } from '../services/authService'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

interface ProfileForm {
  full_name: string
  avatar_url: string
}

export function ProfilePage() {
  const profile = useAuthStore((state) => state.profile)
  const partner = useAuthStore((state) => state.partner)
  const refreshContext = useAuthStore((state) => state.refreshContext)
  const pushToast = useToastStore((state) => state.push)
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit } = useForm<ProfileForm>({
    values: {
      full_name: profile?.full_name ?? '',
      avatar_url: profile?.avatar_url ?? '',
    },
  })

  async function onSubmit(values: ProfileForm) {
    if (!profile) return
    setBusy(true)
    try {
      await updateProfile(profile.id, { full_name: values.full_name, avatar_url: values.avatar_url || null })
      await refreshContext()
      pushToast({ type: 'success', title: 'Perfil actualizado' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos guardar', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Perfil</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-300">
          {partner ? `Vinculado con ${partner.full_name ?? 'tu pareja'}` : 'Sin pareja vinculada. Puedes crear o unirte desde Pareja.'}
        </p>
      </div>
      <form className="grid gap-4 rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:max-w-2xl" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Nombre completo" {...register('full_name')} />
        <Input label="Avatar URL" placeholder="https://..." {...register('avatar_url')} />
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
            Cerrar sesión
          </Button>
        </div>
      </form>
    </section>
  )
}
