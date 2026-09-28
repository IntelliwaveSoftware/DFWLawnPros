import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MousePointerClick,
  Plus,
  Ruler,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '@/api'
import { AddressSearch } from '@/components/AddressSearch'
import { LawnMap, polygonSqft, type LatLng } from '@/components/quote/LawnMap'
import { img } from '@/content/images'
import { TIMEFRAMES } from '@/lib/catalog'
import { consentText, displayConsent, hasPhoneNumber } from '@/lib/consent'
import { moneyRange, num } from '@/lib/format'
import type { GeoResult } from '@/lib/geocode'
import { LAWN_SIZE_PRESETS, PRICING_ITEMS, buildQuote, priceLine, primaryServiceFor } from '@/lib/pricing'
import { getUtm } from '@/lib/utm'

type Step = 'address' | 'measure' | 'services' | 'contact'
const STEPS: { key: Step; label: string }[] = [
  { key: 'address', label: 'Address' },
  { key: 'measure', label: 'Measure' },
  { key: 'services', label: 'Services' },
  { key: 'contact', label: 'Your price' },
]

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.key === step)
  return (
    <ol className="flex items-center gap-2 text-xs font-medium">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex size-6 items-center justify-center rounded-full ${
              i < current ? 'bg-leaf text-white' : i === current ? 'bg-forest text-white' : 'bg-stone text-muted'
            }`}
          >
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={`hidden sm:inline ${i === current ? 'text-forest-900' : 'text-muted'}`}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="h-px w-4 bg-stone sm:w-8" />}
        </li>
      ))}
    </ol>
  )
}

export function InstantQuote() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialAddress = (location.state as { address?: GeoResult } | null)?.address ?? null

  const [step, setStep] = useState<Step>(initialAddress ? 'measure' : 'address')
  const [address, setAddress] = useState<GeoResult | null>(initialAddress)
  const [center, setCenter] = useState<LatLng | null>(initialAddress ? [initialAddress.lat, initialAddress.lng] : null)

  // Measurement
  const [areas, setAreas] = useState<LatLng[][]>([])
  const [drawing, setDrawing] = useState<LatLng[]>([])
  const [preset, setPreset] = useState<string | null>(null)

  // Services: item key -> selected option key ('' when the item has no options)
  const [selected, setSelected] = useState<Record<string, string>>({ mowing: 'weekly' })

  // Contact
  const [contact, setContact] = useState({ name: '', email: '', phone: '', zip: initialAddress?.zip ?? '', city: initialAddress?.city ?? '', timeframe: 'asap', notes: '' })
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const measuredSqft = useMemo(
    () => areas.reduce((s, a) => s + polygonSqft(a), 0) + (drawing.length >= 3 ? polygonSqft(drawing) : 0),
    [areas, drawing],
  )
  const presetSqft = LAWN_SIZE_PRESETS.find((p) => p.key === preset)?.sqft ?? 0
  const measured = measuredSqft > 0
  const sqft = measured ? measuredSqft : presetSqft
  const quote = useMemo(() => buildQuote(sqft, measured, selected), [sqft, measured, selected])

  const chooseAddress = (a: GeoResult) => {
    setAddress(a)
    setCenter([a.lat, a.lng])
    setContact((c) => ({ ...c, zip: a.zip || c.zip, city: a.city || c.city }))
    setAreas([])
    setDrawing([])
    setStep('measure')
  }

  const closeArea = () => {
    if (drawing.length >= 3) {
      setAreas((a) => [...a, drawing])
      setDrawing([])
    }
  }

  const moveVertex = (area: number | 'drawing', index: number, p: LatLng) => {
    if (area === 'drawing') setDrawing((d) => d.map((x, i) => (i === index ? p : x)))
    else setAreas((all) => all.map((poly, ai) => (ai === area ? poly.map((x, i) => (i === index ? p : x)) : poly)))
  }

  const toggleItem = (key: string, defaultOption: string) =>
    setSelected((s) => {
      const next = { ...s }
      if (key in next) delete next[key]
      else next[key] = defaultOption
      return next
    })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (contact.name.trim().length < 2) return setError('Please enter your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return setError('Please enter a valid email.')
    if (hasPhoneNumber(contact.phone) && contact.phone.replace(/\D/g, '').length < 10) {
      return setError('Please enter a 10-digit phone number.')
    }
    if (!/^\d{5}$/.test(contact.zip)) return setError('Please enter your 5-digit ZIP code.')
    if (!consent) return setError('Please agree so we can connect you with a local pro.')

    const summary = quote.lines.map((l) => (l.option ? `${l.label} (${l.option})` : l.label)).join(', ')
    const description =
      // The price estimate lives in `quote` (system-calculated); keeping it out of the free text
      // stops enrichment from mistaking it for a customer-stated budget.
      `Instant quote request: ${summary}. ${measured ? 'Measured' : 'Estimated'} lawn area ~${num(quote.lawn_sqft)} sq ft.` +
      (contact.notes.trim() ? `\n\nCustomer notes: ${contact.notes.trim()}` : '')

    setSubmitting(true)
    try {
      const { id } = await api.submitLead({
        name: contact.name.trim(),
        email: contact.email.trim(),
        ...(hasPhoneNumber(contact.phone) ? { phone: contact.phone.trim() } : {}),
        address: address?.label,
        city: contact.city.trim() || address?.city || '',
        state: address?.state || 'TX',
        zip_code: contact.zip,
        lat: address?.lat,
        lng: address?.lng,
        service: primaryServiceFor(Object.keys(selected)),
        budget: 'not_sure',
        timeframe: contact.timeframe,
        project_description: description,
        details: {
          ...(selected.mowing ? { frequency: selected.mowing } : {}),
          ...(preset && !measured ? { lawn_size_preset: preset } : {}),
          quote_items: Object.keys(selected).join(','),
        },
        source: 'instant_quote',
        quote,
        consent: { accepted: true, text: consentText(contact.phone), timestamp: new Date().toISOString() },
        utm: getUtm(),
      })
      navigate(`/thank-you?ref=${encodeURIComponent(id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Step: address ----------
  if (step === 'address' || !center) {
    return (
      <section className="relative isolate flex min-h-[85vh] items-center overflow-hidden bg-forest-900 pt-24 pb-16 text-white">
        <img src={img.lawnCloseup} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-40" />
        <div className="container-x max-w-3xl text-center">
          <p className="eyebrow text-gold-soft">Instant Quote</p>
          <h1 className="mt-4 text-4xl sm:text-6xl">Get your lawn care price in 60 seconds</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
            Enter your address, outline your lawn on the satellite map, and see your price instantly. No phone tag.
          </p>
          <div className="mx-auto mt-10 max-w-2xl text-left">
            <AddressSearch onSelect={chooseAddress} buttonLabel="Measure my lawn" />
          </div>
          <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/80">
            {['Free & no obligation', 'Vetted local pros', 'Price confirmed on first visit'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-gold-soft" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  }

  // ---------- Steps with map/summary layout ----------
  return (
    <div className="bg-sand/50 pt-18">
      <div className="container-x py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Stepper step={step} />
          <button onClick={() => setStep('address')} className="text-sm text-muted hover:text-forest">
            {address?.label} · <span className="underline">change</span>
          </button>
        </div>
      </div>

      <div className="container-x grid gap-6 pb-16 lg:grid-cols-[1.5fr_1fr]">
        {/* Left column: map during measuring, otherwise a map preview */}
        <div className="relative h-[55vh] min-h-[380px] overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5 lg:h-[calc(100vh-11rem)]">
          <LawnMap
            center={center}
            areas={areas}
            drawing={drawing}
            onAddPoint={(p) => step === 'measure' && setDrawing((d) => [...d, p])}
            onClose={closeArea}
            onMoveVertex={moveVertex}
          />
          <div className="pointer-events-none absolute top-3 left-1/2 z-[500] -translate-x-1/2">
            <div className="rounded-full bg-forest-900/90 px-5 py-2 text-center text-white shadow-lg">
              <span className="text-xs tracking-wide text-white/70 uppercase">{measured ? 'Measured lawn' : 'Lawn area'}</span>
              <span className="font-display ml-2 text-xl">{sqft ? `${num(Math.round(sqft))} sq ft` : '—'}</span>
            </div>
          </div>
          {step === 'measure' && (
            <div className="absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 gap-2">
              <button
                className="btn-sm btn bg-white text-ink shadow disabled:opacity-40"
                disabled={!drawing.length}
                onClick={() => setDrawing((d) => d.slice(0, -1))}
              >
                <Undo2 className="size-4" /> Undo
              </button>
              <button className="btn-sm btn bg-white text-ink shadow disabled:opacity-40" disabled={drawing.length < 3} onClick={closeArea}>
                <Check className="size-4" /> Finish area
              </button>
              <button
                className="btn-sm btn bg-white text-red-700 shadow disabled:opacity-40"
                disabled={!drawing.length && !areas.length}
                onClick={() => {
                  setAreas([])
                  setDrawing([])
                }}
              >
                <Trash2 className="size-4" /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Right column: step panel */}
        <div className="card flex flex-col p-6 sm:p-8">
          {step === 'measure' && (
            <>
              <h1 className="text-2xl text-forest-900 sm:text-3xl">Outline your lawn</h1>
              <ol className="mt-4 space-y-3 text-sm text-muted">
                <li className="flex gap-3">
                  <MousePointerClick className="size-5 shrink-0 text-leaf" />
                  Click around the edges of your grass to drop points. Drag points to adjust.
                </li>
                <li className="flex gap-3">
                  <Check className="size-5 shrink-0 text-leaf" />
                  <span>
                    Click the first (gold) point or <b>Finish area</b> to close the shape.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Plus className="size-5 shrink-0 text-leaf" />
                  Outline front and back yards as separate areas — we add them up.
                </li>
              </ol>

              {areas.length > 0 && (
                <ul className="mt-6 divide-y divide-stone rounded-xl border border-stone">
                  {areas.map((a, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>Area {i + 1}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">{num(Math.round(polygonSqft(a)))} sq ft</span>
                        <button
                          onClick={() => setAreas((all) => all.filter((_, j) => j !== i))}
                          className="text-muted hover:text-red-700"
                          aria-label={`Remove area ${i + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Ruler className="size-4 text-leaf" /> Can’t measure right now? Pick a size:
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {LAWN_SIZE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPreset(preset === p.key ? null : p.key)}
                      disabled={measured}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
                        preset === p.key && !measured ? 'border-forest bg-forest/5 ring-1 ring-forest' : 'border-stone hover:border-forest/50'
                      }`}
                    >
                      <span className="block font-semibold">{p.label}</span>
                      <span className="text-xs text-muted">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-8">
                <button className="btn-primary w-full" disabled={!sqft} onClick={() => { closeArea(); setStep('services') }}>
                  Continue <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          )}

          {step === 'services' && (
            <>
              <h1 className="text-2xl text-forest-900 sm:text-3xl">Choose your services</h1>
              <p className="mt-2 text-sm text-muted">Prices update instantly for your {num(Math.round(sqft))} sq ft lawn.</p>
              <div className="mt-6 space-y-3">
                {PRICING_ITEMS.map((item) => {
                  const on = item.key in selected
                  const line = priceLine(item, sqft, selected[item.key] || undefined)
                  return (
                    <div
                      key={item.key}
                      className={`rounded-xl border p-4 transition-colors ${on ? 'border-forest bg-forest/[0.03] ring-1 ring-forest' : 'border-stone'}`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-forest"
                          checked={on}
                          onChange={() => toggleItem(item.key, item.options?.choices[0].key ?? '')}
                        />
                        <span className="flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold text-ink">{item.label}</span>
                            <span className="text-right text-sm font-semibold whitespace-nowrap text-forest tabular-nums">
                              {moneyRange(line.low, line.high)}
                            </span>
                          </span>
                          <span className="flex justify-between gap-3 text-xs text-muted">
                            <span>{item.description}</span>
                            <span className="whitespace-nowrap">{item.unit}</span>
                          </span>
                        </span>
                      </label>
                      {on && item.options && (
                        <div className="mt-3 ml-7 flex flex-wrap gap-2">
                          {item.options.choices.map((c) => (
                            <button
                              key={c.key}
                              onClick={() => setSelected((s) => ({ ...s, [item.key]: c.key }))}
                              className={`chip border px-3 py-1 ${
                                selected[item.key] === c.key ? 'border-forest bg-forest text-white' : 'border-stone bg-white text-ink'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-auto flex gap-3 pt-8">
                <button className="btn-ghost" onClick={() => setStep('measure')}>
                  <ArrowLeft className="size-4" /> Back
                </button>
                <button className="btn-primary flex-1" disabled={!quote.lines.length} onClick={() => setStep('contact')}>
                  See my price <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          )}

          {step === 'contact' && (
            <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
              <p className="eyebrow">Your instant estimate</p>
              <div className="mt-3 rounded-2xl bg-forest p-5 text-white">
                <ul className="space-y-2 text-sm">
                  {quote.lines.map((l) => (
                    <li key={l.key} className="flex justify-between gap-3">
                      <span className="text-white/85">
                        {l.label}
                        {l.option && <span className="text-white/60"> · {l.option}</span>}
                      </span>
                      <span className="font-semibold whitespace-nowrap tabular-nums">
                        {moneyRange(l.low, l.high)} <span className="text-xs font-normal text-white/60">{l.unit}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-white/15 pt-3 text-xs text-white/65">
                  Based on {measured ? 'your measured' : 'an estimated'} {num(quote.lawn_sqft)} sq ft lawn. Your local pro
                  confirms final pricing on the first visit.
                </p>
              </div>

              <p className="mt-6 font-semibold text-forest-900">Where should your pro reach you?</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input className="input sm:col-span-2" placeholder="Full name" autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                <input className="input" type="email" placeholder="Email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                <input className="input" type="tel" placeholder="Phone" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                <input className="input" placeholder="City" value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} />
                <input className="input" placeholder="ZIP" inputMode="numeric" maxLength={5} value={contact.zip} onChange={(e) => setContact({ ...contact, zip: e.target.value.replace(/\D/g, '') })} />
                <label className="sm:col-span-2">
                  <span className="label">When would you like to start?</span>
                  <select className="input" value={contact.timeframe} onChange={(e) => setContact({ ...contact, timeframe: e.target.value })}>
                    {TIMEFRAMES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  className="input min-h-20 sm:col-span-2"
                  placeholder="Anything else? Dogs, problem areas… (optional)"
                  value={contact.notes}
                  onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                />
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-xl bg-sand/60 p-3 text-[11px] leading-relaxed text-muted">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-forest" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{displayConsent(consentText(contact.phone))}</span>
              </label>
              {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
              <div className="mt-auto flex gap-3 pt-6">
                <button type="button" className="btn-ghost" onClick={() => setStep('services')}>
                  <ArrowLeft className="size-4" /> Back
                </button>
                <button type="submit" className="btn-gold flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Request my service
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
