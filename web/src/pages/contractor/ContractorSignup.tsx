import { Check, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { confirmSignUp, signIn, signUp } from '@/auth/auth'
import { Logo } from '@/components/Logo'

export function ContractorSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const finish = async () => {
    await signIn(form.email, form.password, 'contractor', form.name)
    navigate('/contractor/profile?welcome=1', { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (needsCode) {
        await confirmSignUp(form.email, code)
        await finish()
      } else if (await signUp(form.email, form.password, form.name)) {
        setNeedsCode(true)
      } else {
        await finish()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-forest-900 p-12 text-white lg:flex">
        <Logo light />
        <div>
          <h1 className="text-4xl leading-tight">Grow your landscaping business with exclusive local leads.</h1>
          <ul className="mt-8 space-y-4 text-white/80">
            {[
              'Only see leads in the ZIP codes and services you choose',
              'Exclusive — once you buy a lead, no one else gets it',
              'AI-summarized project details and a quality score on every lead',
              'Simple per-lead pricing. No contracts.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-gold-soft" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Serving the Dallas–Fort Worth Metroplex</p>
      </div>
      <div className="flex items-center justify-center bg-cream px-4 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-3xl text-forest-900">{needsCode ? 'Check your email' : 'Join the network'}</h2>
          <p className="text-sm text-muted">
            {needsCode ? `Enter the verification code we sent to ${form.email}.` : 'Create your account, then set up your company profile.'}
          </p>
          {needsCode ? (
            <input className="input" placeholder="Verification code" value={code} onChange={(e) => setCode(e.target.value)} required />
          ) : (
            <>
              <label className="block">
                <span className="label">Your name</span>
                <input className="input" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="block">
                <span className="label">Work email</span>
                <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
              </label>
            </>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {needsCode ? 'Verify & continue' : 'Create account'}
          </button>
          <p className="text-center text-sm text-muted">
            Already a member?{' '}
            <Link to="/login?role=contractor" className="font-semibold text-forest">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
