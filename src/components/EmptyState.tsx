import { HeartHandshake } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}

export function EmptyState({ title, description, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <section className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-blush-200 bg-white/60 p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-blush-100 text-blush-600 dark:bg-blush-900/30 dark:text-blush-200">
        <HeartHandshake size={38} />
      </div>
      <h2 className="text-xl font-semibold text-stone-950 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-stone-600 dark:text-stone-300">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {children}
    </section>
  )
}
