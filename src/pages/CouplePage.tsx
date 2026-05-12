import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Copy, Link2, LogOut, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Input } from '../components/Input'
import { Modal } from '../components/Modal'
import { inviteCodeSchema, type InviteCodeInput } from '../lib/validations/couple'
import { recordPartnerActivity } from '../services/activityNotificationsService'
import { uploadCoupleAvatar } from '../services/avatarService'
import { createCouple, joinCouple, unlinkCouple, updateCoupleAvatar } from '../services/coupleService'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

export function CouplePage() {
  const profile = useAuthStore((state) => state.profile)
  const couple = useAuthStore((state) => state.couple)
  const partner = useAuthStore((state) => state.partner)
  const refreshContext = useAuthStore((state) => state.refreshContext)
  const pushToast = useToastStore((state) => state.push)
  const [joinOpen, setJoinOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteCodeInput>({ resolver: zodResolver(inviteCodeSchema), mode: 'onChange' })

  async function handleCreate() {
    if (!profile) return
    setBusy(true)
    try {
      const created = await createCouple(profile.id)
      void recordPartnerActivity({
        coupleId: created.id,
        actorId: profile.id,
        targetUserId: null,
        module: 'couple',
        action: 'created',
        entityType: 'couple',
        entityId: created.id,
        title: 'Pareja creada',
        body: 'Creo el espacio de pareja.',
        newData: { ...created },
      })
      await refreshContext()
      pushToast({ type: 'success', title: 'Pareja creada', description: `Codigo ${created.invite_code}, valido por 48 horas.` })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos crear la pareja', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(input: InviteCodeInput) {
    if (!profile) return
    setBusy(true)
    try {
      const linkedPartner = await joinCouple(profile.id, input.inviteCode)
      await refreshContext()
      setJoinOpen(false)
      reset()
      pushToast({
        type: 'success',
        title: 'Pareja vinculada',
        description: linkedPartner?.full_name ? `Ahora compartes DuoLife con ${linkedPartner.full_name}.` : 'Vinculacion completada.',
      })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos vincularte', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlink() {
    if (!couple) return
    const confirmed = window.confirm('Desvincular pareja? Ambos perfiles quedaran sin pareja y los datos compartidos dejaran de verse.')
    if (!confirmed) return
    setBusy(true)
    try {
      if (profile) {
        await recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner?.id,
          module: 'couple',
          action: 'deleted',
          entityType: 'couple',
          entityId: couple.id,
          title: 'Pareja desvinculada',
          body: 'Desvinculo la pareja.',
          oldData: { ...couple },
        })
      }
      await unlinkCouple(couple.id)
      await refreshContext()
      pushToast({ type: 'success', title: 'Pareja desvinculada' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos desvincular', description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function handleCoupleAvatarChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!couple || !file) return
    if (!file.type.startsWith('image/')) {
      pushToast({ type: 'error', title: 'Archivo invalido', description: 'Selecciona una imagen.' })
      return
    }

    setUploadingAvatar(true)
    try {
      const avatarUrl = await uploadCoupleAvatar(couple.id, file)
      await updateCoupleAvatar(couple.id, avatarUrl)
      await refreshContext()
      if (profile) {
        void recordPartnerActivity({
          coupleId: couple.id,
          actorId: profile.id,
          targetUserId: partner?.id,
          module: 'couple',
          action: 'uploaded',
          entityType: 'couple',
          entityId: couple.id,
          title: 'Foto de pareja actualizada',
          body: 'Actualizo la foto de pareja.',
          oldData: { avatar_url: couple.avatar_url },
          newData: { avatar_url: avatarUrl },
        })
      }
      pushToast({ type: 'success', title: 'Foto de pareja actualizada' })
    } catch (error) {
      pushToast({ type: 'error', title: 'No pudimos subir la foto', description: (error as Error).message })
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (!couple) {
    return (
      <>
        <EmptyState
          title="Aun no tienes pareja vinculada"
          description="Crea un codigo para invitar a tu pareja o ingresa el codigo que ella te compartio. El codigo dura 48 horas y solo permite dos miembros."
        >
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button icon={<Plus size={18} />} onClick={handleCreate} disabled={busy}>
              Crear pareja
            </Button>
            <Button variant="secondary" icon={<Link2 size={18} />} onClick={() => setJoinOpen(true)}>
              Unirme con codigo
            </Button>
          </div>
        </EmptyState>
        <Modal open={joinOpen} title="Unirse a pareja" onClose={() => setJoinOpen(false)}>
          <form className="space-y-4" onSubmit={handleSubmit(handleJoin)}>
            <Input label="Codigo de invitacion" placeholder="AB12CD34" error={errors.inviteCode?.message} {...register('inviteCode')} />
            <Button className="w-full" disabled={busy}>
              Vincular pareja
            </Button>
          </form>
        </Modal>
      </>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950 dark:text-white">Pareja</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-300">Opciones de vinculacion ocultas mientras tienes pareja activa.</p>
      </div>
      <div className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar src={couple.avatar_url} kind="couple" size="lg" />
          <div>
            <p className="font-semibold text-stone-950 dark:text-white">Foto de pareja</p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Se usara cuando un evento represente a ambos.</p>
            <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blush-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-blush-800 transition hover:bg-blush-50 dark:border-white/10 dark:bg-white/5 dark:text-blush-100 dark:hover:bg-white/10">
              <Camera size={17} />
              {uploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingAvatar}
                onChange={(event) => void handleCoupleAvatarChange(event.target.files)}
              />
            </label>
          </div>
        </div>
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Codigo activo</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="rounded-2xl bg-blush-50 px-4 py-3 text-2xl font-bold tracking-[0.2em] text-blush-700 dark:bg-white/10 dark:text-blush-100">
            {couple.invite_code}
          </code>
          <Button variant="secondary" icon={<Copy size={17} />} onClick={() => void navigator.clipboard.writeText(couple.invite_code)}>
            Copiar
          </Button>
        </div>
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
          Pareja vinculada: {partner?.full_name ?? 'Esperando a tu pareja'}
        </p>
      </div>
      <Button variant="danger" icon={<LogOut size={17} />} onClick={handleUnlink} disabled={busy}>
        Desvincular pareja
      </Button>
    </section>
  )
}
