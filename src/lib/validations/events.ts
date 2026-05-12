import { z } from 'zod'

export const eventSchema = z.object({
  title: z.string().min(2, 'El titulo es obligatorio'),
  description: z.string().optional(),
  start_at: z.string().min(1, 'La fecha de inicio es obligatoria'),
  end_at: z.string().optional(),
  location: z.string().optional(),
  color: z.string().optional(),
  is_shared: z.boolean(),
  actor_type: z.enum(['user', 'couple']),
  repeat_frequency: z.enum(['none', 'weekly']).default('none'),
  repeat_count: z.number().int().min(1, 'Minimo 1').max(52, 'Maximo 52').default(1),
})

export type EventInput = z.infer<typeof eventSchema>
export type EventFormInput = z.input<typeof eventSchema>
