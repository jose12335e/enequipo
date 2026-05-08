import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(value: string | null | undefined, pattern = 'd MMM yyyy') {
  if (!value) return 'Sin fecha'
  return format(parseISO(value), pattern, { locale: es })
}

export function formatDateTime(value: string) {
  const date = parseISO(value)
  if (isToday(date)) return `Hoy, ${format(date, 'HH:mm')}`
  if (isTomorrow(date)) return `Mañana, ${format(date, 'HH:mm')}`
  return format(date, "d MMM, HH:mm", { locale: es })
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    maximumFractionDigits: 2,
  }).format(amount)
}
