import { z } from 'zod'

export const noteSchema = z.object({
  title: z.string().min(2, 'El título es obligatorio'),
  content: z.string().min(2, 'El contenido es obligatorio'),
  category: z.string().optional(),
  is_shared: z.boolean(),
})

export type NoteInput = z.infer<typeof noteSchema>
