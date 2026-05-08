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
  enterDemo: () => void
  clear: () => void
}

const demoSession = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 60 * 60 * 24,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@doulife.local',
    app_metadata: {},
    user_metadata: { full_name: 'Demo DuoLife' },
    created_at: new Date().toISOString(),
  },
} as Session

const demoProfile: UserProfile = {
  id: demoSession.user.id,
  full_name: 'Demo DuoLife',
  avatar_url: null,
  couple_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
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
    if (userId === demoSession.user.id) return
    if (!userId) {
      set({ profile: null, couple: null, partner: null })
      return
    }
    const user = get().session?.user
    await ensureProfile(userId, user?.user_metadata?.full_name, user?.email)
    const context = await getCoupleContext(userId)
    set({ profile: context.profile, couple: context.couple, partner: context.partner })
  },
  enterDemo: () =>
    set({
      session: demoSession,
      profile: demoProfile,
      couple: null,
      partner: null,
      loading: false,
    }),
  clear: () => set({ session: null, profile: null, couple: null, partner: null, loading: false }),
}))
