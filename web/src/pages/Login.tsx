import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { completeNewPassword, NewPasswordRequiredError, signIn } from '@/auth/auth'
import type { Session } from '@/auth/session'
import { Logo } from '@/components/Logo'
import { AUTH_MODE } from '@/config/env'
import { DEMO_ADMIN, DEMO_CONTRACTOR } from '@/api/mock/seed'

export function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const role = params.get('role') === 'admin' ? 'admin' : 'contractor'
  const demo = role === 'admin' ? DEMO_ADMIN : DEMO_CONTRACTOR
  const localEmail = role === 'admin' ? 'admin@local.test' : 'contractor@local.test'
  const [email, setEmail] = useState(AUTH_MODE === 'mock' ? demo.email : AUTH_MODE === 'local' ? localEmail : '')
  const [password, setPassword] = useState(AUTH_MODE === 'mock' ? demo.password : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Set when an invited user signs in with a temporary password and must choose their own.
  const [challenge, setChallenge] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function goHome(session: Session) {
    const home = session.user.role === 'admin' ? '/admin' : '/contractor'
    const next = params.get('next')
    navigate(next && next.startsWith(home) ? next : home, { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (challenge) {
        if (newPassword !== confirmPassword) throw new Error('The passwords don’t match.')
        goHome(await completeNewPassword(email, newPassword, challenge))
      } else {
        goHome(await signIn(email, password, role))
      }
    } catch (err) {
      if (err instanceof NewPasswordRequiredError) {
        setChallenge(err.session)
        setPassword('')
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand/60 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={onSubmit} className="card space-y-4 p-8">
          <div>
            <h1 className="text-2xl text-forest-900">
              {challenge ? 'Choose your password' : role === 'admin' ? 'Admin sign in' : 'Contractor sign in'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {challenge
                ? `You signed in with a temporary password. Set your own to finish signing in as ${email}.`
                : role === 'admin'
                  ? 'Internal lead dashboard.'
                  : 'Access your leads and company profile.'}
            </p>
          </div>
          {challenge ? (
            <>
              <label className="block">
                <span className="label">New password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
                <span className="mt-1 block text-xs text-muted">At least 8 characters, including a lowercase letter and a number.</span>
              </label>
              <label className="block">
                <span className="label">Confirm new password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="label">Email</span>
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          )}
          {!challenge && AUTH_MODE !== 'local' && (
            <label className="block">
              <span className="label">Password</span>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} {challenge ? 'Set password and sign in' : 'Sign in'}
          </button>
          {AUTH_MODE === 'local' && (
            <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">
              Local development sign-in: no password. You’ll be signed in as {role === 'admin' ? 'an admin' : 'a contractor'} against
              the local API. Seeded data uses <b>{localEmail}</b>.
            </p>
          )}
          {AUTH_MODE === 'mock' && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Demo mode: prefilled with <b>{demo.email}</b> / <b>{demo.password}</b>.
            </p>
          )}
        </form>
        <div className="mt-6 flex justify-between text-sm text-muted">
          {role === 'contractor' ? (
            <>
              <Link to="/contractor/signup" className="hover:text-forest">
                New company? Apply to join
              </Link>
              <Link to="/login?role=admin" className="hover:text-forest">
                Admin
              </Link>
            </>
          ) : (
            <Link to="/login?role=contractor" className="hover:text-forest">
              Contractor sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
