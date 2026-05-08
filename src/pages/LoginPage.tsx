import { zodResolver } from '@hookform/resolvers/zod'
import { Heart, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { loginSchema, type LoginInput } from '../lib/validations/auth'
import { signIn } from '../services/authService'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

export function LoginPage() {
  const navigate = useNavigate()
  const refreshContext = useAuthStore((state) => state.refreshContext)
  const enterDemo = useAuthStore((state) => state.enterDemo)
  const pushToast = useToastStore((state) => state.push)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: 'onChange' })

  async function onSubmit(input: LoginInput) {
    setSubmitting(true)
    try {
      await signIn(input.email, input.password)
      await refreshContext()
      pushToast({ type: 'success', title: 'Sesión iniciada' })
      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos iniciar sesión', description: (error as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleDemo() {
    enterDemo()
    pushToast({ type: 'info', title: 'Modo demo activo', description: 'Puedes ver la app sin correo ni Supabase configurado.' })
    navigate('/app/dashboard', { replace: true })
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-white/10 dark:bg-stone-950/75">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blush-500 text-white">
            <Heart size={22} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-950 dark:text-white">DuoLife</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">Organiza la vida compartida.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Email" type="email" icon={<Mail size={17} />} error={errors.email?.message} {...register('email')} />
          <Input label="Contraseña" type="password" icon={<Lock size={17} />} error={errors.password?.message} {...register('password')} />
          <Button className="w-full" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
          <Button type="button" variant="secondary" className="w-full" onClick={handleDemo}>
            Ver demo sin correo
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600 dark:text-stone-300">
          ¿Primera vez?{' '}
          <Link className="font-semibold text-blush-700 dark:text-blush-200" to="/register">
            Crear cuenta
          </Link>
        </p>
      </section>
    </main>
  )
}
