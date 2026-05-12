import { z } from 'zod'

const optionalNumber = z.preprocess((value) => (Number.isNaN(value) ? undefined : value), z.number().optional())

export const expenseSchema = z
  .object({
    amount: z.number().positive('El monto debe ser mayor a 0'),
    category: z.string().min(2, 'La categoria es obligatoria'),
    description: z.string().optional(),
    date: z.string().min(1, 'La fecha es obligatoria'),
    paid_by: z.string().min(1, 'Selecciona quien pago'),
    split_mode: z.enum(['50_50', '60_40', '70_30', '80_20', '100_0', 'custom_percent', 'custom_amount']),
    custom_user_percentage: optionalNumber.pipe(z.number().min(0).max(100).optional()),
    custom_partner_percentage: optionalNumber.pipe(z.number().min(0).max(100).optional()),
    user_amount: optionalNumber.pipe(z.number().min(0).optional()),
    partner_amount: optionalNumber.pipe(z.number().min(0).optional()),
  })
  .superRefine((value, context) => {
    if (value.split_mode === 'custom_percent') {
      const user = value.custom_user_percentage ?? Number.NaN
      const partner = value.custom_partner_percentage ?? Number.NaN
      if (!Number.isFinite(user) || !Number.isFinite(partner) || Math.round((user + partner) * 100) / 100 !== 100) {
        context.addIssue({
          code: 'custom',
          path: ['custom_partner_percentage'],
          message: 'Los porcentajes deben sumar 100%',
        })
      }
    }

    if (value.split_mode === 'custom_amount') {
      const user = value.user_amount ?? Number.NaN
      const partner = value.partner_amount ?? Number.NaN
      if (!Number.isFinite(user) || !Number.isFinite(partner) || Math.round((user + partner) * 100) / 100 !== Math.round(value.amount * 100) / 100) {
        context.addIssue({
          code: 'custom',
          path: ['partner_amount'],
          message: 'Los montos deben sumar el total',
        })
      }
    }
  })

export const settlementSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  from_user: z.string().min(1, 'Selecciona quien paga'),
  to_user: z.string().min(1, 'Selecciona quien recibe'),
  note: z.string().optional(),
})

export type ExpenseInput = z.infer<typeof expenseSchema>
export type ExpenseFormInput = z.input<typeof expenseSchema>
export type SettlementInput = z.infer<typeof settlementSchema>
