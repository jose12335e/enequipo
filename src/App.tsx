import { Navigate, Route, Routes } from 'react-router-dom'
import { Toasts } from './components/Toasts'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedRoute } from './layouts/ProtectedRoute'
import { CalendarPage } from './pages/CalendarPage'
import { CouplePage } from './pages/CouplePage'
import { DashboardPage } from './pages/DashboardPage'
import { FinancesPage } from './pages/FinancesPage'
import { LoginPage } from './pages/LoginPage'
import { NotesPage } from './pages/NotesPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { TasksPage } from './pages/TasksPage'

function App() {
  useAuthBootstrap()

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="finances" element={<FinancesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="couple" element={<CouplePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
      <Toasts />
    </>
  )
}

export default App
