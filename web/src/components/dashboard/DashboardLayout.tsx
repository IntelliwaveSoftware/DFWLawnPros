import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Logo'
import { API_BASE_URL, AUTH_MODE } from '@/config/env'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export function DashboardLayout({ title, nav }: { title: string; nav: NavItem[] }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo light to="/" />
        <p className="mt-2 text-xs tracking-wide text-white/50 uppercase">{title}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <n.icon className="size-4" /> {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-white/50">{user?.email}</p>
        <button
          onClick={() => {
            signOut()
            navigate('/')
          }}
          className="mt-3 flex items-center gap-2 text-xs text-white/60 hover:text-white"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-forest-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-forest-900">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone/60 bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
        <span className="font-semibold text-forest-900">{title}</span>
      </header>
      {AUTH_MODE === 'mock' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          Demo mode — data is stored in this browser. Set <code>VITE_API_BASE_URL</code> to connect to AWS Lambda.
        </div>
      )}
      {AUTH_MODE === 'local' && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-xs text-sky-900">
          Local development — API <code>{API_BASE_URL}</code>, password-less sign-in.
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
