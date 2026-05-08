import { zodResolver } from '@hookform/resolvers/zod'
import { Heart, Lock, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { registerSchema, type RegisterInput } from '../lib/validations/auth'
import { signUp } from '../services/authService'
import { useToastStore } from '../store/toastStore'
import { friendlyAuthError } from '../utils/authErrors'

export function RegisterPage() {
  const navigate = useNavigate()
  const pushToast = useToastStore((state) => state.push)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), mode: 'onChange' })

  async function onSubmit(input: RegisterInput) {
    setSubmitting(true)
    try {
      await signUp(input.email, input.password, input.fullName)
      pushToast({
        type: 'success',
        title: 'Cuenta creada',
        description: 'Tu cuenta empieza sin pareja vinculada. Puedes vincularla desde Perfil.',
      })
      navigate('/login', { replace: true })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos registrarte', description: friendlyAuthError(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-white/10 dark:bg-stone-950/75">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blush-500 text-white">
            <Heart size={22} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-950 dark:text-white">Crear cuenta</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">Empiezas sin pareja vinculada.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre completo" icon={<User size={17} />} error={errors.fullName?.message} {...register('fullName')} />
          <Input label="Email" type="email" icon={<Mail size={17} />} error={errors.email?.message} {...register('email')} />
          <Input label="Contraseña" type="password" icon={<Lock size={17} />} error={errors.password?.message} {...register('password')} />
          <Button className="w-full" disabled={submitting}>
            {submitting ? 'Creando...' : 'Registrarme'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600 dark:text-stone-300">
          ¿Ya tienes cuenta?{' '}
          <Link className="font-semibold text-blush-700 dark:text-blush-200" to="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  )
}
