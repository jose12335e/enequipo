import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export function StatCard({
  label,
  value,
  icon,
  className,
}: {
  label: string
  value: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <article className={cn('rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]', className)}>
      <div className="mb-4 flex items-center justify-between gap-3 text-blush-600 dark:text-blush-200">{icon}</div>
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-950 dark:text-white">{value}</p>
    </article>
  )
}
