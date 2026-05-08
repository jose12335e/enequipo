import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { ensureProfile } from '../services/authService'
import { getCoupleContext } from '../services/coupleService'
import type { Couple, UserProfile } from '../types/app'

interface AuthState {
  session: Session | null
  profile: UserProfile | null
  couple: Couple | null
  partner: UserProfile | null
  loading: boolean
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  refreshContext: () => Promise<void>
  clear: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  couple: null,
  partner: null,
  loading: true,
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  refreshContext: async () => {
    const userId = get().session?.user.id
    if (!userId) {
      set({ profile: null, couple: null, partner: null })
      return
    }
    const user = get().session?.user
    await ensureProfile(userId, user?.user_metadata?.full_name, user?.email)
    const context = await getCoupleContext(userId)
    set({ profile: context.profile, couple: context.couple, partner: context.partner })
  },
  clear: () => set({ session: null, profile: null, couple: null, partner: null, loading: false }),
}))
