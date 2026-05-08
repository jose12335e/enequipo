import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: ReactNode
}

export function Button({ className, variant = 'primary', icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-blush-300 disabled:cursor-not-allowed disabled:opacity-55',
        variant === 'primary' &&
          'bg-blush-500 text-white shadow-soft hover:bg-blush-600 dark:bg-blush-400 dark:text-blush-950 dark:hover:bg-blush-300',
        variant === 'secondary' &&
          'border border-blush-200 bg-white/80 text-blush-800 hover:bg-blush-50 dark:border-white/10 dark:bg-white/5 dark:text-blush-100 dark:hover:bg-white/10',
        variant === 'ghost' &&
          'text-stone-700 hover:bg-white/70 dark:text-stone-100 dark:hover:bg-white/10',
        variant === 'danger' &&
          'bg-red-500 text-white hover:bg-red-600 dark:bg-red-400 dark:text-red-950',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
