import { Loader2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api'
import { BUDGETS, CONDITIONAL_QUESTIONS, SERVICES, TIMEFRAMES } from '@/lib/catalog'
import { consentText, displayConsent, hasPhoneNumber } from '@/lib/consent'
import { getUtm } from '@/lib/utm'
import type { ServiceKey } from '@/lib/types'

interface FormState {
  name: string
  email: string
  phone: string
  zip_code: string
  city: string
  service: ServiceKey | ''
  budget: string
  timeframe: string
  project_description: string
  details: Record<string, string>
  consent: boolean
}

type Errors = Partial<Record<keyof FormState, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(f: FormState): Errors {
  const e: Errors = {}
  if (f.name.trim().length < 2) e.name = 'Please enter your name.'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Please enter a valid email.'
  if (hasPhoneNumber(f.phone) && f.phone.replace(/\D/g, '').length < 10) e.phone = 'Please enter a 10-digit phone number.'
  if (!/^\d{5}$/.test(f.zip_code.trim())) e.zip_code = 'Enter a 5-digit ZIP.'
  if (!f.city.trim()) e.city = 'Please enter your city.'
  if (!f.service) e.service = 'Choose a service.'
  if (!f.budget) e.budget = 'Choose a budget range.'
  if (!f.timeframe) e.timeframe = 'Choose a timeframe.'
  if (f.project_description.trim().length < 10) e.project_description = 'Tell us a little about your project.'
  if (!f.consent) e.consent = 'Please agree so we can connect you with a local pro.'
  return e
}

function Field({ label, error, children, className = '' }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

export function LeadForm({ defaultService = '' }: { defaultService?: ServiceKey | '' }) {
  const navigate = useNavigate()
  const [f, setF] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    zip_code: '',
    city: '',
    service: defaultService,
    budget: '',
    timeframe: '',
    project_description: '',
    details: {},
    consent: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  const questions = f.service ? (CONDITIONAL_QUESTIONS[f.service] ?? []) : []
  // The consent wording depends on whether a phone number was given.
  const consent = consentText(f.phone)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    setServerError('')
    try {
      // Only keep answers to questions that apply to the chosen service.
      const details = Object.fromEntries(questions.filter((q) => f.details[q.key]).map((q) => [q.key, f.details[q.key]]))
      const { id } = await api.submitLead({
        name: f.name.trim(),
        email: f.email.trim(),
        ...(hasPhoneNumber(f.phone) ? { phone: f.phone.trim() } : {}),
        city: f.city.trim(),
        state: 'TX',
        zip_code: f.zip_code.trim(),
        service: f.service as ServiceKey,
        budget: f.budget,
        timeframe: f.timeframe,
        project_description: f.project_description.trim(),
        details,
        source: 'lead_form',
        consent: { accepted: true, text: consent, timestamp: new Date().toISOString() },
        utm: getUtm(),
      })
      navigate(`/thank-you?ref=${encodeURIComponent(id)}`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again or call us.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.name}>
        <input className="input" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Phone" error={errors.phone}>
        <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field label="Email" error={errors.email} className="sm:col-span-2">
        <input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="City" error={errors.city}>
        <input className="input" autoComplete="address-level2" value={f.city} onChange={(e) => set('city', e.target.value)} />
      </Field>
      <Field label="ZIP code" error={errors.zip_code}>
        <input
          className="input"
          inputMode="numeric"
          maxLength={5}
          autoComplete="postal-code"
          value={f.zip_code}
          onChange={(e) => set('zip_code', e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Field label="Service needed" error={errors.service} className="sm:col-span-2">
        <select className="input" value={f.service} onChange={(e) => set('service', e.target.value as ServiceKey)}>
          <option value="">Select a service…</option>
          {SERVICES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {questions.map((q) => (
        <Field key={q.key} label={q.label}>
          <select
            className="input"
            value={f.details[q.key] ?? ''}
            onChange={(e) => set('details', { ...f.details, [q.key]: e.target.value })}
          >
            <option value="">Select…</option>
            {q.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      ))}

      <Field label="Approximate budget" error={errors.budget}>
        <select className="input" value={f.budget} onChange={(e) => set('budget', e.target.value)}>
          <option value="">Select…</option>
          {BUDGETS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Desired timeframe" error={errors.timeframe}>
        <select className="input" value={f.timeframe} onChange={(e) => set('timeframe', e.target.value)}>
          <option value="">Select…</option>
          {TIMEFRAMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tell us about your project" error={errors.project_description} className="sm:col-span-2">
        <textarea
          className="input min-h-28"
          placeholder="e.g. We’d like to redo the backyard with a paver patio, new sod and some shade trees."
          value={f.project_description}
          onChange={(e) => set('project_description', e.target.value)}
        />
      </Field>

      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 rounded-xl bg-sand/60 p-4 text-xs leading-relaxed text-muted">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-forest"
            checked={f.consent}
            onChange={(e) => set('consent', e.target.checked)}
          />
          <span>{displayConsent(consent)}</span>
        </label>
        {errors.consent && <span className="mt-1 block text-xs text-red-700">{errors.consent}</span>}
      </div>

      {serverError && <p className="text-sm text-red-700 sm:col-span-2">{serverError}</p>}

      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Get my free quote
        </button>
      </div>
    </form>
  )
}
