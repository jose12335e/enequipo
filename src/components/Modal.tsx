import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-stone-950/45 p-3 backdrop-blur-sm transition md:items-center md:justify-center">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-soft transition dark:bg-stone-950 md:max-w-xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-950 dark:text-white">{title}</h2>
          <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full px-0" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </Button>
        </header>
        {children}
      </section>
    </div>
  )
}
