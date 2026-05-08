import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '../components/Skeleton'
import { useAuthStore } from '../store/authStore'

export function ProtectedRoute() {
  const session = useAuthStore((state) => state.session)
  const loading = useAuthStore((state) => state.loading)
  const location = useLocation()

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-48" />
        </div>
      </main>
    )
  }

  if (!session) return <Navigate to="/login" state={{ from: location }} replace />

  return <Outlet />
}
