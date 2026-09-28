// Local development sign-in (VITE_AUTH_MODE=local). No password and no signature: the token just
// carries the claims API Gateway's JWT authorizer would pass to the Lambda. Only the backend's local
// dev server accepts these tokens; a deployed API Gateway rejects them.
import type { Role } from '@/lib/types'
import type { Session } from './session'

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export function localSignIn(email: string, role: Role, name?: string): Session {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter an email address.')
  const claims = {
    // Must match backend/scripts/seed.ts, which links seeded contractors to "local:<email>".
    sub: `local:${normalized}`,
    email: normalized,
    name: name?.trim() || normalized.split('@')[0],
    'cognito:groups': role === 'admin' ? '[admin]' : '[]',
  }
  return {
    user: { id: claims.sub, email: normalized, name: claims.name, role },
    idToken: `local.${toBase64Url(JSON.stringify(claims))}`,
    expiresAt: Date.now() + 30 * 86_400_000,
  }
}
