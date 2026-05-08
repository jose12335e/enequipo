import { Heart } from 'lucide-react'
import { cn } from '../utils/cn'

interface AvatarProps {
  src?: string | null
  name?: string | null
  kind?: 'user' | 'couple'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-9 w-9 rounded-2xl text-xs',
  md: 'h-10 w-10 rounded-2xl text-sm',
  lg: 'h-20 w-20 rounded-[1.75rem] text-2xl',
}

export function Avatar({ src, name, kind = 'user', size = 'md', className }: AvatarProps) {
  const label = kind === 'couple' ? 'Foto de pareja' : (name ?? 'Avatar')

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        className={cn(sizeClasses[size], 'shrink-0 object-cover ring-1 ring-white/70 dark:ring-white/10', className)}
      />
    )
  }

  if (kind === 'couple') {
    return (
      <div
        className={cn(
          sizeClasses[size],
          'grid shrink-0 place-items-center bg-blush-500 text-white ring-1 ring-white/70 dark:bg-blush-400 dark:text-blush-950 dark:ring-white/10',
          className,
        )}
        aria-label={label}
      >
        <Heart size={size === 'lg' ? 30 : 18} fill="currentColor" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        'grid shrink-0 place-items-center bg-blush-100 font-bold text-blush-700 ring-1 ring-white/70 dark:bg-blush-900/40 dark:text-blush-100 dark:ring-white/10',
        className,
      )}
      aria-label={label}
    >
      {(name?.[0] ?? 'D').toUpperCase()}
    </div>
  )
}
