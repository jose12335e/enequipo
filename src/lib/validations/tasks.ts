import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(2, 'El título es obligatorio'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'in_progress', 'done']),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
})

export type TaskInput = z.infer<typeof taskSchema>
