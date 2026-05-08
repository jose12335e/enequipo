import { z } from 'zod'

export const eventSchema = z.object({
  title: z.string().min(2, 'El título es obligatorio'),
  description: z.string().optional(),
  start_at: z.string().min(1, 'La fecha de inicio es obligatoria'),
  end_at: z.string().optional(),
  location: z.string().optional(),
  color: z.string().optional(),
  is_shared: z.boolean(),
  actor_type: z.enum(['user', 'couple']),
})

export type EventInput = z.infer<typeof eventSchema>
