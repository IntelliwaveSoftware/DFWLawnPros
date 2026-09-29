// Ad landing page: one goal (start a quote), no site navigation. Ads link here with ?service=…&city=…
// so the headline matches the ad. Below the banner, the quote section works like the instant-quote page:
// its map shows our own metro aerial image until an address is entered (banner or section input), then
// flies to the home and the quote continues in place. Landscaping pages show the consultation form instead.
import { BadgeCheck, Check, ChevronDown, Loader2, Mail, MapPin, Phone, PhoneCall, Ruler, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '@/api'
import { AddressSearch } from '@/components/AddressSearch'
import { ConsultationForm } from '@/components/ConsultationForm'
import { Logo } from '@/components/Logo'
import { PHONE_HREF, PUBLIC_EMAIL, PUBLIC_PHONE } from '@/config/env'
import { img } from '@/content/images'
import { LANDING_CITIES, LANDING_COPY, LANDING_FAQ, resolveCity, resolveService, type LandingService } from '@/content/landing'
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
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-ink shadow-2xl ring-1 ring-black/5 [text-shadow:none]">
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
  const landscaping = service === 'landscaping'
  const sectionRef = useRef<HTMLElement>(null)
  // An address typed in the banner is handed to the quote section (a new id each time).
  const [addressRequest, setAddressRequest] = useState<{ address: GeoResult; id: number } | null>(null)

  useNoIndex(title)
  useEffect(() => {
    setTrackingContext({ page: 'landing', service, city })
    track('page_view')
  }, [service, city])

  const scrollToSection = () => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const fromBanner = (address: GeoResult) => {
    setAddressRequest({ address, id: Date.now() })
    scrollToSection()
  }

  const trust = [
    [BadgeCheck, 'Vetted local pros only', 'We review every company before it joins the network.'],
    [Users, 'One pro, not a bidding war', 'Your request goes to a single company that serves your area.'],
    [ShieldCheck, 'Free, no obligation', 'Getting a price costs nothing and commits you to nothing.'],
    [Sparkles, 'Price confirmed on site', 'Your pro confirms the final price on the first visit.'],
  ] as const

  return (
    <div className="min-h-screen bg-cream">
      {/* Banner: same background as the home page */}
      <section className="relative isolate overflow-hidden bg-forest-900 text-white">
        <img src={img.hero} alt="" className="absolute inset-0 -z-10 size-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        {/* The home page's text sits low, over the darkest part; here it's higher, so darken behind it too. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        <header className="container-x flex h-16 items-center justify-between">
          <Logo light />
          <CallButton dark />
        </header>
        <div className="container-x grid min-h-[calc(80svh-4rem)] items-center gap-10 pt-6 pb-16 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)] lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow text-gold-soft">{copy.eyebrow}</p>
            <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">{copy.subtitle}</p>
            <div className="mt-8 max-w-2xl [text-shadow:none]">
              {landscaping ? (
                <button onClick={scrollToSection} className="btn-gold h-14 w-full px-8 text-base sm:w-auto">
                  Start my free estimate
                </button>
              ) : (
                <AddressSearch onSelect={fromBanner} buttonLabel="See my price" placeholder="Enter your home address" />
              )}
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
              {['Free & no obligation', 'Vetted local pros', 'No spam calls'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-gold-soft" /> {t}
                </li>
              ))}
            </ul>
          </div>
          {!landscaping && (
            <div className="hidden justify-end lg:flex">
              <SampleEstimate service={service} />
            </div>
          )}
        </div>
      </section>

      {/* Quote section (like the instant-quote page), or the consultation form for landscaping */}
      <section ref={sectionRef} id="quote" className="scroll-mt-4 bg-sand/50">
        {landscaping ? (
          <div className="container-x py-14">
            <p className="eyebrow">Request a consultation</p>
            <h2 className="mt-2 mb-8 text-3xl text-forest-900 sm:text-4xl">Tell us about your project</h2>
            <ConsultationForm service="landscaping" city={city} showInstantQuote={false} />
          </div>
        ) : (
          <InstantQuote embedded addressRequest={addressRequest} initialItems={copy.quoteItems} />
        )}
      </section>

      {/* How it works */}
      <section className="container-x py-16 sm:py-20">
        <p className="eyebrow text-center">How it works</p>
        <h2 className="mt-3 text-center text-3xl text-forest-900 sm:text-4xl">
          {landscaping ? 'Three steps to a free estimate' : 'Your price in three steps'}
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
        {!landscaping && (
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
            Leave your number and a vetted local pro will call you back — usually within one business day.
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

      {/* Contact */}
      <section className="bg-forest-900 py-14 text-white">
        <div className="container-x grid gap-8 sm:grid-cols-3">
          <div>
            <p className="eyebrow text-gold-soft">Call us</p>
            <a href={PHONE_HREF} onClick={() => track('call_clicked')} className="mt-2 flex items-center gap-2 text-lg font-semibold hover:underline">
              <Phone className="size-5 text-gold-soft" /> {PUBLIC_PHONE}
            </a>
          </div>
          <div>
            <p className="eyebrow text-gold-soft">Email</p>
            <a href={`mailto:${PUBLIC_EMAIL}`} className="mt-2 flex items-center gap-2 text-lg font-semibold hover:underline">
              <Mail className="size-5 text-gold-soft" /> {PUBLIC_EMAIL}
            </a>
          </div>
          <div>
            <p className="eyebrow text-gold-soft">Service area</p>
            <p className="mt-2 flex gap-2 text-sm text-white/80">
              <MapPin className="size-5 shrink-0 text-gold-soft" />
              <span>Dallas–Fort Worth: {LANDING_CITIES.join(', ')} and surrounding cities.</span>
            </p>
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
