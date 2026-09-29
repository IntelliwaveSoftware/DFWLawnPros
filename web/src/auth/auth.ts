// Auth facade: Cognito when an API is configured, demo accounts in mock mode, and a
// password-less local mode for running against the backend's local dev server.
import { AUTH_MODE } from '@/config/env'
import { mockSignIn, mockSignUp } from '@/api/mock/mockAuth'
import type { Role } from '@/lib/types'
import { cognitoCompleteNewPassword, cognitoConfirm, cognitoRefresh, cognitoSignIn, cognitoSignUp } from './cognito'
import { localSignIn } from './localAuth'
import { loadSession, saveSession, type Session } from './session'

let current: Session | null = loadSession()
const listeners = new Set<(s: Session | null) => void>()

function set(session: Session | null) {
  current = session
  saveSession(session)
  listeners.forEach((fn) => fn(session))
}

export const getSession = () => current

export function onSessionChange(fn: (s: Session | null) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Returns a valid ID token, refreshing it if it's about to expire. */
export async function getIdToken(): Promise<string | null> {
  if (!current) return null
  if (AUTH_MODE !== 'cognito' || current.expiresAt - Date.now() > 60_000) return current.idToken
  if (!current.refreshToken) {
    set(null)
    return null
  }
  try {
    set(await cognitoRefresh(current.refreshToken))
    return current?.idToken ?? null
  } catch {
    set(null)
    return null
  }
}

/** `role` is only used in local mode, where there is no user pool to say who is an admin. */
export async function signIn(email: string, password: string, role: Role = 'contractor', name?: string) {
  const session =
    AUTH_MODE === 'mock'
      ? await mockSignIn(email, password)
      : AUTH_MODE === 'local'
        ? localSignIn(email, role, name)
        : await cognitoSignIn(email, password)
  set(session)
  return session
}

export { NewPasswordRequiredError } from './cognito'

/** Second step of an invited user's first sign-in (see NewPasswordRequiredError). */
export async function completeNewPassword(email: string, newPassword: string, challengeSession: string) {
  const session = await cognitoCompleteNewPassword(email, newPassword, challengeSession)
  set(session)
  return session
}

/** Returns true when the user must confirm their email with a code before signing in. */
export async function signUp(email: string, password: string, name: string): Promise<boolean> {
  if (AUTH_MODE === 'mock') {
    await mockSignUp(email, password, name)
    return false
  }
  if (AUTH_MODE === 'local') return false
  await cognitoSignUp(email, password, name)
  return true
}

export async function confirmSignUp(email: string, code: string) {
  if (AUTH_MODE === 'cognito') await cognitoConfirm(email, code)
}

export function signOut() {
  set(null)
}
