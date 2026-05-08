import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore } from '../store/toastStore'
import { Button } from './Button'

export function Toasts() {
  const toasts = useToastStore((state) => state.toasts)
  const remove = useToastStore((state) => state.remove)

  return (
    <div className="fixed right-4 top-4 z-[60] w-[min(92vw,380px)] space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur dark:border-white/10 dark:bg-stone-950/95"
        >
          <div className="mt-0.5 text-blush-600 dark:text-blush-200">
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <XCircle size={18} /> : <Info size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-950 dark:text-white">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{toast.description}</p> : null}
          </div>
          <Button variant="ghost" className="h-8 min-h-8 w-8 rounded-full px-0" onClick={() => remove(toast.id)} aria-label="Cerrar toast">
            <X size={15} />
          </Button>
        </div>
      ))}
    </div>
  )
}
