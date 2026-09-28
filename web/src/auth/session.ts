import type { SessionUser } from '@/lib/types'

export interface Session {
  user: SessionUser
  idToken: string
  refreshToken?: string
  /** epoch ms */
  expiresAt: number
}

const KEY = 'dfwlp.session'

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable (private mode) — session lives only in memory for this tab
  }
}
