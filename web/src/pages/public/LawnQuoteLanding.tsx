// Ad landing page: one goal (start a quote), no site navigation. Ads link here with ?service=…&city=…
// so the headline matches the ad; picking an address opens the instant quote in place.
import { ArrowRight, BadgeCheck, Check, ChevronDown, Phone, Ruler, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AddressSearch } from '@/components/AddressSearch'
import { Logo } from '@/components/Logo'
import { staticSatelliteUrl } from '@/components/quote/satellite'
import { PHONE_HREF, PUBLIC_PHONE } from '@/config/env'
import { img } from '@/content/images'
import { LANDING_COPY, LANDING_FAQ, resolveCity, resolveService, type LandingService } from '@/content/landing'
import { moneyRange, num } from '@/lib/format'
import type { GeoResult } from '@/lib/geocode'
import { PRICING_ITEMS, priceLine } from '@/lib/pricing'
import { setTrackingContext, track } from '@/lib/track'
import { InstantQuote } from './InstantQuote'

// A typical Frisco neighborhood for the hero backdrop.
const HERO_CENTER: [number, number] = [33.1507, -96.8236]

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

export function LawnQuoteLanding() {
  const [params] = useSearchParams()
  const service: LandingService = resolveService(params.get('service')) ?? 'lawn_care'
  const city = resolveCity(params.get('city'))
  const copy = LANDING_COPY[service]
  const title = copy.title(city ?? 'Dallas–Fort Worth')
  const [address, setAddress] = useState<GeoResult | null>(null)
  const heroImage = useMemo(() => staticSatelliteUrl(HERO_CENTER, 18, 1400, 900) ?? img.hero, [])

  useNoIndex(title)
  useEffect(() => {
    setTrackingContext({ page: 'landing', service, city })
    track('page_view')
  }, [service, city])

  const start = (a: GeoResult) => {
    track('address_entered')
    setAddress(a)
    window.scrollTo({ top: 0 })
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
        <InstantQuote address={address} initialItems={copy.quoteItems} onChangeAddress={() => setAddress(null)} />
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
        <img src={heroImage} alt="" className="absolute inset-0 -z-20 size-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-900/95 via-forest-900/80 to-forest-900/40" />
        <header className="container-x flex h-16 items-center justify-between">
          <Logo light to={null} />
          <CallButton dark />
        </header>
        <div className="container-x grid min-h-[calc(88svh-4rem)] items-center gap-10 pt-6 pb-16 lg:grid-cols-[1.4fr_1fr]">
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
        <a href="#how" className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-white sm:block" aria-label="How it works">
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
