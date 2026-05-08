import { z } from 'zod'

export const expenseSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  category: z.string().min(2, 'La categoría es obligatoria'),
  description: z.string().optional(),
  date: z.string().min(1, 'La fecha es obligatoria'),
  paid_by: z.string().min(1, 'Selecciona quién pagó'),
  split_type: z.enum(['50_50', 'one_paid', 'custom']),
  partner_percentage: z.number().min(0).max(100).optional(),
})

export const settlementSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  from_user: z.string().min(1, 'Selecciona quién paga'),
  to_user: z.string().min(1, 'Selecciona quién recibe'),
  note: z.string().optional(),
})

export type ExpenseInput = z.infer<typeof expenseSchema>
export type SettlementInput = z.infer<typeof settlementSchema>
