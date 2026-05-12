import {
  CalendarDays,
  CheckSquare,
  CircleDollarSign,
  HeartHandshake,
  Home,
  NotebookText,
  UserRound,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { UpdateAnnouncement } from '../components/UpdateAnnouncement'
import { useAuthStore } from '../store/authStore'
import { cn } from '../utils/cn'

const navItems = [
  { to: '/app/dashboard', label: 'Inicio', icon: Home },
  { to: '/app/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/app/notes', label: 'Notas', icon: NotebookText },
  { to: '/app/tasks', label: 'Tareas', icon: CheckSquare },
  { to: '/app/finances', label: 'Finanzas', icon: CircleDollarSign },
]

function NavItem({ to, label, icon: Icon }: (typeof navItems)[number]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-stone-600 transition hover:bg-white/65 hover:text-blush-700 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-blush-100 md:px-4',
          isActive && 'bg-white text-blush-700 shadow-sm dark:bg-white/10 dark:text-blush-100',
        )
      }
    >
      <Icon size={20} />
      <span className="hidden md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
    </NavLink>
  )
}

function CoupleMark({
  profile,
  partner,
  coupleAvatar,
}: {
  profile: ReturnType<typeof useAuthStore.getState>['profile']
  partner: ReturnType<typeof useAuthStore.getState>['partner']
  coupleAvatar?: string | null
}) {
  if (coupleAvatar) return <Avatar src={coupleAvatar} kind="couple" className="h-11 w-11" />

  if (partner) {
    return (
      <div className="relative h-11 w-14">
        <Avatar src={profile?.avatar_url} name={profile?.full_name} className="absolute left-0 top-0 h-11 w-11 rounded-2xl ring-2 ring-white dark:ring-stone-950" />
        <Avatar src={partner.avatar_url} name={partner.full_name} className="absolute right-0 top-0 h-11 w-11 rounded-2xl ring-2 ring-white dark:ring-stone-950" />
      </div>
    )
  }

  return <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blush-500 font-bold text-white">DL</div>
}

export function AppLayout() {
  const profile = useAuthStore((state) => state.profile)
  const partner = useAuthStore((state) => state.partner)
  const couple = useAuthStore((state) => state.couple)

  return (
    <div className="min-h-screen text-stone-900 dark:text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/70 bg-white/60 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/70 md:block">
        <div className="mb-8 flex items-center gap-3">
          <CoupleMark profile={profile} partner={partner} coupleAvatar={couple?.avatar_url} />
          <div>
            <p className="font-semibold text-stone-950 dark:text-white">DuoLife</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Vida compartida</p>
          </div>
        </div>
        <nav className="space-y-2">{navItems.map((item) => <NavItem key={item.to} {...item} />)}</nav>
      </aside>

      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/75 md:ml-72 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="md:hidden">
            <p className="text-lg font-bold text-stone-950 dark:text-white">DuoLife</p>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-3">
              <CoupleMark profile={profile} partner={partner} coupleAvatar={couple?.avatar_url} />
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400">Hola, {profile?.full_name ?? 'pareja'}</p>
                <p className="inline-flex items-center gap-2 font-semibold text-stone-950 dark:text-white">
                  {partner ? (
                    <>
                      <HeartHandshake size={17} className="text-blush-400" />
                      {partner.full_name ?? 'Tu pareja'}
                    </>
                  ) : (
                    'Sin pareja vinculada'
                  )}
                </p>
              </div>
            </div>
          </div>
          <NavLink to="/app/profile" className="flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-white/70 dark:hover:bg-white/10">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} />
            <UserRound className="hidden text-stone-400 md:block" size={18} />
          </NavLink>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 md:ml-72 md:px-8 md:pb-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t border-white/70 bg-white/85 p-2 backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/90 md:hidden">
        {navItems.map((item) => <NavItem key={item.to} {...item} />)}
      </nav>

      <UpdateAnnouncement />
    </div>
  )
}
