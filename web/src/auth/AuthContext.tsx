import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role, SessionUser } from '@/lib/types'
import { getSession, onSessionChange, signOut } from './auth'

const AuthContext = createContext<{ user: SessionUser | null; signOut: () => void }>({
  user: null,
  signOut,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => getSession()?.user ?? null)
  useEffect(
    () =>
      onSessionChange((s) => {
        setUser(s?.user ?? null)
      }),
    [],
  )
  return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user || user.role !== role) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}&role=${role}`} replace />
  }
  return <>{children}</>
}
