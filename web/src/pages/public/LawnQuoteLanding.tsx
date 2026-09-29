// Ad landing page: one goal (start a quote), no site navigation. Ads link here with ?service=…&city=…
// so the headline matches the ad. The hero shows our own metro aerial image (no map requests on page
// load); picking an address loads the live map behind it at the same framing, cross-fades, and flies to
// the customer's home before the instant quote takes over.
import { ArrowRight, BadgeCheck, Check, ChevronDown, Loader2, Phone, PhoneCall, Ruler, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '@/api'
import { AddressSearch } from '@/components/AddressSearch'
import { Logo } from '@/components/Logo'
import { FlyInMap } from '@/components/quote/FlyInMap'
import { PHONE_HREF, PUBLIC_PHONE } from '@/config/env'
import { BACKDROP, LANDING_COPY, LANDING_FAQ, resolveCity, resolveService, type LandingService } from '@/content/landing'
import { SERVICES } from '@/lib/catalog'
import { consentText, displayConsent } from '@/lib/consent'
import { moneyRange, num } from '@/lib/format'
import type { GeoResult } from '@/lib/geocode'
import { PRICING_ITEMS, priceLine } from '@/lib/pricing'
import { setTrackingContext, track } from '@/lib/track'
import type { ServiceKey } from '@/lib/types'
import { getUtm } from '@/lib/utm'
import { InstantQuote } from './InstantQuote'

function useNoIndex(title: string) {
  useEffect(() => {
    document.title = `${title} | DFW Lawn Pros`
    // Paid-traffic pages shouldn't compete with the main site in search results.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [title])
}

function CallButton({ dark = false }: { dark?: boolean }) {
  return (
    <a
      href={PHONE_HREF}
      onClick={() => track('call_clicked')}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
        dark ? 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20' : 'bg-forest text-white hover:bg-forest-900'
      }`}
    >
      <Phone className="size-4" />
      <span className="hidden sm:inline">{PUBLIC_PHONE}</span>
      <span className="sm:hidden">Call</span>
    </a>
  )
}

/** What an estimate looks like, priced with the real calculator so it never drifts from the quote tool. */
function SampleEstimate({ service }: { service: LandingService }) {
  const sqft = service === 'artificial_turf' ? 1200 : 4820
  const keys = service === 'artificial_turf' ? ['artificial_turf'] : ['mowing', 'fertilization', 'aeration']
  const lines = PRICING_ITEMS.filter((i) => keys.includes(i.key)).map((i) => priceLine(i, sqft))
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-ink shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Sample estimate</p>
        <span className="chip bg-leaf/15 text-forest">
          <Ruler className="size-3.5" /> {num(sqft)} sq ft
        </span>
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span>
              {l.label}
              {l.option && <span className="text-muted"> · {l.option}</span>}
            </span>
            <span className="font-semibold whitespace-nowrap text-forest tabular-nums">
              {moneyRange(l.low, l.high)} <span className="text-xs font-normal text-muted">{l.unit}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-stone pt-3 text-xs text-muted">Confirmed by a vetted local pro on the first visit.</p>
    </div>
  )
}

function StartQuote({ service, city, onAddress, dark }: { service: LandingService; city?: string; onAddress: (a: GeoResult) => void; dark?: boolean }) {
  if (service === 'landscaping') {
    const params = new URLSearchParams({ service: 'landscaping', ...(city ? { city } : {}) })
    return (
      <Link to={`/get-quote?${params}`} className="btn-gold h-14 w-full px-8 text-base sm:w-auto">
        Start my free estimate <ArrowRight className="size-4" />
      </Link>
    )
  }
  return (
    <div className={dark ? '' : 'mx-auto max-w-2xl'}>
      <AddressSearch onSelect={onAddress} buttonLabel="See my price" placeholder="Enter your home address" />
    </div>
  )
}

/** For visitors who'd rather talk: the fewest fields the lead API accepts, with a phone number required. */
function CallbackForm({ service, city }: { service: LandingService; city?: string }) {
  const navigate = useNavigate()
  const [f, setF] = useState({ name: '', phone: '', email: '', zip: '', city: city ?? '', service: service as ServiceKey })
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (f.name.trim().length < 2) return setError('Please enter your name.')
    if (f.phone.replace(/\D/g, '').length < 10) return setError('Please enter a 10-digit phone number.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError('Please enter a valid email.')
    if (!/^\d{5}$/.test(f.zip)) return setError('Please enter your 5-digit ZIP code.')
    if (!f.city.trim()) return setError('Please enter your city.')
    if (!consent) return setError('Please agree so a local pro can call you.')
    const label = SERVICES.find((s) => s.key === f.service)?.label ?? f.service
    setSubmitting(true)
    try {
      const { id } = await api.submitLead({
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        city: f.city.trim(),
        state: 'TX',
        zip_code: f.zip,
        service: f.service,
        budget: 'not_sure',
        timeframe: 'asap',
        project_description: `Callback request (${label}). The customer asked a local pro to call them to talk through their project.`,
        details: { request_type: 'callback' },
        source: 'lead_form',
        consent: { accepted: true, text: consentText(f.phone), timestamp: new Date().toISOString() },
        utm: getUtm(),
      })
      track('callback_submitted')
      navigate(`/thank-you?ref=${encodeURIComponent(id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again or call us.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
      <input className="input sm:col-span-2" placeholder="Full name" autoComplete="name" value={f.name} onChange={set('name')} />
      <input className="input" type="tel" placeholder="Phone" autoComplete="tel" value={f.phone} onChange={set('phone')} />
      <input className="input" type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={set('email')} />
      {!city && <input className="input" placeholder="City" autoComplete="address-level2" value={f.city} onChange={set('city')} />}
      <input
        className={`input ${city ? 'sm:col-span-2' : ''}`}
        placeholder="ZIP"
        inputMode="numeric"
        maxLength={5}
        autoComplete="postal-code"
        value={f.zip}
        onChange={(e) => setF((prev) => ({ ...prev, zip: e.target.value.replace(/\D/g, '') }))}
      />
      <select className="input sm:col-span-2" value={f.service} onChange={set('service')} aria-label="Service">
        {SERVICES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <label className="flex items-start gap-3 rounded-xl bg-sand/60 p-3 text-[11px] leading-relaxed text-muted sm:col-span-2">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-forest" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{displayConsent(consentText(f.phone))}</span>
      </label>
      {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      <button type="submit" className="btn-primary sm:col-span-2" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />} Call me back
      </button>
    </form>
  )
}

export function LawnQuoteLanding() {
  const [params] = useSearchParams()
  const service: LandingService = resolveService(params.get('service')) ?? 'lawn_care'
  const city = resolveCity(params.get('city'))
  const copy = LANDING_COPY[service]
  const title = copy.title(city ?? 'Dallas–Fort Worth')
  // Address picked → `flying` (live map fades in and flies to the house) → `address` (quote tool).
  const [flying, setFlying] = useState<GeoResult | null>(null)
  const [tilesReady, setTilesReady] = useState(false)
  const [address, setAddress] = useState<GeoResult | null>(null)
  const markTilesReady = useCallback(() => setTilesReady(true), [])
  const arrive = useCallback(() => setAddress((a) => a ?? flying), [flying])

  useNoIndex(title)
  useEffect(() => {
    setTrackingContext({ page: 'landing', service, city })
    track('page_view')
  }, [service, city])

  const start = (a: GeoResult) => {
    track('address_entered')
    setTilesReady(false)
    setFlying(a)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const restart = () => {
    setAddress(null)
    setFlying(null)
    setTilesReady(false)
  }

  // After an address is picked, the quote tool takes over the page (map → services → price).
  if (address) {
    return (
      <div className="min-h-screen bg-sand/50">
        <header className="fixed inset-x-0 top-0 z-[1000] border-b border-stone/70 bg-cream/95 backdrop-blur">
          <div className="container-x flex h-16 items-center justify-between">
            <Logo to={null} />
            <CallButton />
          </div>
        </header>
        <InstantQuote address={address} initialItems={copy.quoteItems} onChangeAddress={restart} />
      </div>
    )
  }

  const trust = [
    [BadgeCheck, 'Vetted local pros only', 'We review every company before it joins the network.'],
    [Users, 'One pro, not a bidding war', 'Your request goes to a single company that serves your area.'],
    [ShieldCheck, 'Free, no obligation', 'Getting a price costs nothing and commits you to nothing.'],
    [Sparkles, 'Price confirmed on site', 'Your pro confirms the final price on the first visit.'],
  ] as const

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-forest-900 text-white">
        {flying && (
          <div className="absolute inset-0 -z-30">
            <FlyInMap
              center={BACKDROP.center}
              zoom={BACKDROP.zoom}
              to={[flying.lat, flying.lng]}
              ready={tilesReady}
              onTilesReady={markTilesReady}
              onArrive={arrive}
            />
          </div>
        )}
        {/* Drawn at exactly one CSS pixel per map pixel and centered, so it lines up with the live map's
            opening view (widths match BACKDROP; md = Tailwind's 768px breakpoint). */}
        <picture className={`pointer-events-none absolute inset-0 -z-20 transition-opacity duration-[600ms] ${tilesReady ? 'opacity-0' : ''}`}>
          <source media="(max-width: 767px)" srcSet={BACKDROP.tall.src} />
          <img
            src={BACKDROP.wide.src}
            alt=""
            fetchPriority="high"
            style={{ filter: BACKDROP.filter }}
            className="absolute top-1/2 left-1/2 h-auto w-[780px] max-w-none -translate-x-1/2 -translate-y-1/2 md:w-[2560px]"
          />
        </picture>
        <div
          className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-forest-900/80 via-forest-900/45 to-forest-900/10 transition-opacity duration-700 ${
            flying ? 'opacity-0' : ''
          }`}
        />
        <header className="container-x flex h-16 items-center justify-between">
          <Logo light to={null} />
          <CallButton dark />
        </header>
        <div
          className={`container-x grid min-h-[calc(88svh-4rem)] items-center gap-10 pt-6 pb-16 transition-opacity duration-300 [text-shadow:0_1px_12px_rgba(12,28,19,0.7)] lg:grid-cols-[1.4fr_1fr] ${
            flying ? 'pointer-events-none opacity-0' : ''
          }`}
        >
          <div>
            <p className="eyebrow text-gold-soft">{copy.eyebrow}</p>
            <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">{copy.subtitle}</p>
            <div className="mt-8 max-w-2xl">
              <StartQuote service={service} city={city} onAddress={start} dark />
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              {['Free & no obligation', 'Vetted local pros', 'No spam calls'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-gold-soft" /> {t}
                </li>
              ))}
            </ul>
          </div>
          {service !== 'landscaping' && (
            <div className="hidden justify-end lg:flex">
              <SampleEstimate service={service} />
            </div>
          )}
        </div>
        {flying && (
          <p className="absolute inset-x-0 bottom-8 text-center text-sm font-medium text-white drop-shadow">Finding your home…</p>
        )}
        <a
          href="#how"
          className={`absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-white sm:block ${flying ? 'invisible' : ''}`}
          aria-label="How it works"
        >
          <ChevronDown className="size-6" />
        </a>
      </section>

      {/* How it works */}
      <section id="how" className="container-x py-16 sm:py-20">
        <p className="eyebrow text-center">How it works</p>
        <h2 className="mt-3 text-center text-3xl text-forest-900 sm:text-4xl">
          {service === 'landscaping' ? 'Three steps to a free estimate' : 'Your price in three steps'}
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {copy.steps.map(([head, body], i) => (
            <li key={head} className="card p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-forest font-semibold text-white">{i + 1}</span>
              <p className="mt-4 font-semibold text-forest-900">{head}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
        {service !== 'landscaping' && (
          <div className="mt-10 flex justify-center lg:hidden">
            <SampleEstimate service={service} />
          </div>
        )}
      </section>

      {/* Callback */}
      <section className="container-x grid items-center gap-10 pb-16 sm:pb-20 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <PhoneCall className="size-8 text-leaf" />
          <h2 className="mt-4 text-3xl text-forest-900 sm:text-4xl">Rather talk to someone?</h2>
          <p className="mt-3 max-w-md text-muted">
            Leave your number and a vetted local pro will call you back — usually within one business day. Prefer to call
            now?{' '}
            <a href={PHONE_HREF} onClick={() => track('call_clicked')} className="font-semibold text-forest underline-offset-4 hover:underline">
              {PUBLIC_PHONE}
            </a>
          </p>
        </div>
        <CallbackForm service={service} city={city} />
      </section>

      {/* Trust */}
      <section className="bg-sand/60 py-16 sm:py-20">
        <div className="container-x grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(([Icon, head, body]) => (
            <div key={head}>
              <Icon className="size-7 text-leaf" />
              <p className="mt-3 font-semibold text-forest-900">{head}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x max-w-3xl py-16 sm:py-20">
        <h2 className="text-center text-3xl text-forest-900">Questions</h2>
        <div className="mt-8 divide-y divide-stone rounded-2xl border border-stone bg-white">
          {LANDING_FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {q}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-forest-900 py-16 text-center text-white sm:py-20">
        <div className="container-x">
          <h2 className="text-3xl sm:text-4xl">{service === 'landscaping' ? 'Ready for a free estimate?' : 'Ready to see your price?'}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">
            {service === 'landscaping' ? 'It takes about two minutes.' : 'Enter your address — it takes about 60 seconds.'}
          </p>
          <div className="mt-8">
            <StartQuote service={service} city={city} onAddress={start} />
          </div>
        </div>
      </section>

      <footer className="container-x flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted">
        <span>© {new Date().getFullYear()} DFW Lawn Pros</span>
        <Link to="/privacy" className="hover:text-forest">
          Privacy
        </Link>
      </footer>
    </div>
  )
}
