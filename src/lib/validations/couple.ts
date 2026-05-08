import { z } from 'zod'

export const inviteCodeSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(8, 'El código tiene 8 caracteres')
    .max(8, 'El código tiene 8 caracteres')
    .regex(/^[a-zA-Z0-9]+$/, 'Solo letras y números'),
})

export type InviteCodeInput = z.infer<typeof inviteCodeSchema>
