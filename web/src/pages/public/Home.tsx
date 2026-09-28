import { ArrowRight, Check, ChevronDown, Clock, Mail, MapPin, Phone, Star } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { AddressSearch } from '@/components/AddressSearch'
import { BeforeAfter } from '@/components/BeforeAfter'
import { LeadForm } from '@/components/LeadForm'
import { SectionHeading } from '@/components/SectionHeading'
import { PHONE_HREF, PUBLIC_EMAIL, PUBLIC_PHONE } from '@/config/env'
import { img } from '@/content/images'
import { PORTFOLIO } from '@/content/portfolio'
import {
  AUDIENCES,
  FAQS,
  HERO,
  PILLARS,
  PROCESS,
  REVIEWS,
  SERVICE_AREA,
  SERVICE_CARDS,
  STATS,
} from '@/content/site'
import type { GeoResult } from '@/lib/geocode'

function Hero() {
  const navigate = useNavigate()
  const onAddress = (address: GeoResult) => navigate('/instant-quote', { state: { address } })

  return (
    <section className="relative isolate flex min-h-[92vh] items-end overflow-hidden bg-forest-900 pt-28 pb-10 text-white">
      <img src={img.hero} alt="" className="absolute inset-0 -z-10 size-full object-cover" fetchPriority="high" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
      <div className="container-x">
        <div className="max-w-3xl">
          <p className="eyebrow text-gold-soft">{HERO.eyebrow}</p>
          <h1 className="mt-4 text-4xl leading-[1.05] font-medium sm:text-6xl lg:text-7xl">{HERO.title}</h1>
          <p className="mt-6 max-w-2xl text-lg text-white/85">{HERO.subtitle}</p>
          <div className="mt-8 max-w-2xl">
            <AddressSearch onSelect={onAddress} buttonLabel="Get instant quote" />
            <p className="mt-3 pl-4 text-sm text-white/75">
              Planning a patio, design or install?{' '}
              <Link to="/get-quote" className="font-semibold text-white underline-offset-4 hover:underline">
                Request a consultation <ArrowRight className="inline size-3.5" />
              </Link>
            </p>
          </div>
        </div>
        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/15 backdrop-blur sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-black/25 px-5 py-4">
              <dt className="text-xs tracking-wide text-white/70 uppercase">{s.label}</dt>
              <dd className="font-display mt-1 text-2xl sm:text-3xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function PortfolioPreview() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading index={1} eyebrow="Portfolio" title="Recent projects across the Metroplex">
            Backyard renovations, pool surrounds, sod and front-yard makeovers completed by companies in our network.
          </SectionHeading>
          <Link to="/portfolio" className="btn-outline shrink-0 text-forest">
            View all {PORTFOLIO.length} projects <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PORTFOLIO.slice(0, 3).map((p) => (
            <Link key={p.slug} to={`/portfolio/${p.slug}`} className="group block">
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={p.cover}
                  alt={p.title}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <h3 className="text-xl text-forest-900">{p.title}</h3>
                <span className="text-sm text-muted">{p.city}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{p.services.join(' · ')}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Services() {
  return (
    <section id="services" className="scroll-mt-20 bg-sand/60 py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading index={2} eyebrow="Services" title="Every outdoor service, one simple request">
          Tell us what you need and we’ll match you with a local company that specializes in it.
        </SectionHeading>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_CARDS.map((s) => (
            <Link
              key={s.key}
              to={s.key === 'lawn_care' ? '/instant-quote' : `/get-quote?service=${s.key}`}
              className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-xl hover:shadow-black/5"
            >
              <div className="overflow-hidden">
                <img
                  src={s.image}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-xl text-forest-900">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest">
                  {s.key === 'lawn_care' ? 'Instant quote' : 'Get a quote'}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Audiences() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading index={3} eyebrow="Residential & Commercial" title="Homes, HOAs and commercial properties" />
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          {AUDIENCES.map((a) => (
            <article key={a.title}>
              <img src={a.image} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-2xl object-cover" />
              <h3 className="mt-6 text-2xl text-forest-900">{a.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{a.body}</p>
              <ul className="mt-4 space-y-2">
                {a.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-leaf" /> {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Renovations() {
  return (
    <section className="bg-forest-900 py-20 text-white sm:py-28">
      <div className="container-x grid items-center gap-12 lg:grid-cols-[1fr_1.4fr]">
        <SectionHeading index={4} eyebrow="Renovations" title="From tired turf to a lawn you’re proud of" light>
          Thin, patchy Bermuda is common after a North Texas summer. Our partners handle soil prep, grading, sod and
          irrigation tune-ups so it comes back thick and green.
          <div className="mt-8">
            <Link to="/get-quote?service=sod" className="btn-gold">
              Quote a lawn renovation
            </Link>
          </div>
        </SectionHeading>
        {/* Demo imagery: replace `before` with a real before photo and remove beforeStyle. */}
        <BeforeAfter
          before={img.frontYard}
          after={img.frontYard}
          beforeStyle={{ filter: 'saturate(0.25) sepia(0.55) brightness(0.9) contrast(0.95)' }}
          alt="Front lawn renovation"
        />
      </div>
    </section>
  )
}

function Reviews() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading index={5} eyebrow="Homeowners" title="What DFW homeowners say" />
          <div className="flex items-center gap-3">
            <div className="flex text-gold">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-5 fill-current" />
              ))}
            </div>
            <span className="text-sm text-muted">Rated by homeowners we’ve matched</span>
          </div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure key={r.text} className="card p-7">
              <div className="flex text-gold">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="font-display mt-4 text-lg leading-relaxed text-forest-900">“{r.text}”</blockquote>
              <figcaption className="mt-5 text-sm text-muted">— {r.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhyUs() {
  return (
    <section className="relative isolate overflow-hidden py-20 text-white sm:py-28">
      <img src={img.lawnCloseup} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-forest-900/85" />
      <div className="container-x">
        <SectionHeading index={6} eyebrow="The DFW Lawn Pros Difference" title="Communication. Reliability. Accountability." light />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <div key={p.title} className="rounded-2xl border border-white/15 bg-white/5 p-7 backdrop-blur">
              <span className="font-display text-4xl text-gold-soft">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-4 text-xl">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Process() {
  return (
    <section id="process" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading index={7} eyebrow="Process" title="How it works" />
        <ol className="mt-12 grid gap-6 md:grid-cols-5">
          {PROCESS.map((s, i) => (
            <li key={s.title} className="relative border-t-2 border-forest pt-6">
              <span className="font-display text-5xl text-stone">{i + 1}</span>
              <h3 className="mt-3 font-sans text-base font-semibold text-forest-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ServiceArea() {
  return (
    <section id="service-area" className="scroll-mt-20 bg-sand/60 py-20 sm:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-2">
        <SectionHeading index={8} eyebrow="Service Area" title="Serving the entire Dallas–Fort Worth Metroplex">
          {SERVICE_AREA.intro}
        </SectionHeading>
        <ul className="flex flex-wrap content-start gap-2">
          {SERVICE_AREA.cities.map((c) => (
            <li key={c} className="chip gap-1.5 border border-stone bg-white px-3.5 py-1.5 text-sm text-ink">
              <MapPin className="size-3.5 text-leaf" /> {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.5fr]">
        <SectionHeading index={9} eyebrow="FAQs" title="Questions, answered" />
        <div className="divide-y divide-stone border-y border-stone">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-forest-900">
                {f.q}
                <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function StartProject() {
  return (
    <section id="start" className="scroll-mt-20 bg-forest py-20 sm:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <div className="text-white">
          <SectionHeading index={10} eyebrow="Start Your Project" title="Tell us about your yard" light>
            Free, no-obligation. A qualified local company will reach out — usually within one business day.
          </SectionHeading>
          <ul className="mt-10 space-y-4 text-sm text-white/85">
            <li className="flex items-center gap-3">
              <Phone className="size-4 text-gold-soft" />
              <a href={PHONE_HREF} className="hover:text-white">
                {PUBLIC_PHONE}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-4 text-gold-soft" />
              <a href={`mailto:${PUBLIC_EMAIL}`} className="hover:text-white">
                {PUBLIC_EMAIL}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Clock className="size-4 text-gold-soft" /> Mon–Fri 7am–7pm · Sat 8am–5pm
            </li>
          </ul>
        </div>
        <div className="rounded-3xl bg-cream p-6 shadow-2xl sm:p-10">
          <LeadForm />
        </div>
      </div>
    </section>
  )
}

export function Home() {
  return (
    <>
      <Hero />
      <PortfolioPreview />
      <Services />
      <Audiences />
      <Renovations />
      <Reviews />
      <WhyUs />
      <Process />
      <ServiceArea />
      <Faq />
      <StartProject />
    </>
  )
}
