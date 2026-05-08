import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getSession } from '../services/authService'
import { useAuthStore } from '../store/authStore'

export function useAuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession)
  const setLoading = useAuthStore((state) => state.setLoading)
  const refreshContext = useAuthStore((state) => state.refreshContext)
  const clear = useAuthStore((state) => state.clear)

  useEffect(() => {
    let mounted = true

    getSession()
      .then(async (session) => {
        if (!mounted) return
        setSession(session)
        if (session) await refreshContext()
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT' || !session) {
        clear()
        return
      }
      void refreshContext()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [clear, refreshContext, setLoading, setSession])
}
