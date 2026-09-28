import type { Session } from '@/auth/session'
import { db, persist } from './store'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

export async function mockSignIn(email: string, password: string): Promise<Session> {
  await delay()
  const user = db().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || user.password !== password) throw new Error('Incorrect email or password.')
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    idToken: `mock.${user.id}`,
    expiresAt: Date.now() + 7 * 86_400_000,
  }
}

export async function mockSignUp(email: string, password: string, name: string) {
  await delay()
  const d = db()
  if (d.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    throw new Error('An account with this email already exists.')
  }
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')
  d.users.push({ id: `c-${crypto.randomUUID().slice(0, 8)}`, email: email.trim(), password, name, role: 'contractor' })
  persist()
}
