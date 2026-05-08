import { useAuthStore } from '../store/authStore'

export function useCoupleRequired() {
  const profile = useAuthStore((state) => state.profile)
  const couple = useAuthStore((state) => state.couple)
  const partner = useAuthStore((state) => state.partner)

  return {
    hasCouple: Boolean(profile?.couple_id && couple),
    profile,
    couple,
    partner,
  }
}
