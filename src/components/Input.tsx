import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

interface FieldProps {
  label: string
  error?: string
  icon?: ReactNode
}

export function Input({ label, error, icon, className, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{label}</span>
      <span className="relative block">
        {icon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{icon}</span> : null}
        <input
          className={cn(
            'h-11 w-full rounded-2xl border border-blush-100 bg-white/85 px-3 text-sm text-stone-900 outline-none transition focus:border-blush-300 focus:ring-2 focus:ring-blush-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blush-900/40',
            icon && 'pl-10',
            error && 'border-red-300 focus:border-red-300 focus:ring-red-100',
            className,
          )}
          {...props}
        />
      </span>
      {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
    </label>
  )
}

export function Textarea({
  label,
  error,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{label}</span>
      <textarea
        className={cn(
          'min-h-28 w-full resize-none rounded-2xl border border-blush-100 bg-white/85 px-3 py-3 text-sm text-stone-900 outline-none transition focus:border-blush-300 focus:ring-2 focus:ring-blush-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blush-900/40',
          error && 'border-red-300 focus:border-red-300 focus:ring-red-100',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
    </label>
  )
}

export function Select({
  label,
  error,
  className,
  children,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{label}</span>
      <select
        className={cn(
          'h-11 w-full rounded-2xl border border-blush-100 bg-white/85 px-3 text-sm text-stone-900 outline-none transition focus:border-blush-300 focus:ring-2 focus:ring-blush-100 dark:border-white/10 dark:bg-stone-900 dark:text-white dark:focus:ring-blush-900/40',
          error && 'border-red-300 focus:border-red-300 focus:ring-red-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
    </label>
  )
}
