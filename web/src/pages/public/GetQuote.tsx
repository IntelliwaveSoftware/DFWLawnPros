import { Check, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LeadForm } from '@/components/LeadForm'
import { img } from '@/content/images'
import { getService } from '@/lib/catalog'
import { setTrackingContext } from '@/lib/track'
import type { ServiceKey } from '@/lib/types'

export function GetQuote() {
  const [params] = useSearchParams()
  const service = getService(params.get('service') ?? '')?.key ?? ''
  // Set by the landscaping version of the ad landing page.
  const city = (params.get('city') ?? '').slice(0, 60)

  useEffect(() => setTrackingContext({ page: 'lead_form', service: service || undefined, city: city || undefined }), [service, city])

  return (
    <div className="pt-18">
      <div className="relative isolate overflow-hidden bg-forest-900 py-16 text-white">
        <img src={img.design} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-30" />
        <div className="container-x">
          <p className="eyebrow text-gold-soft">Request a consultation</p>
          <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">Tell us about your project</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Two minutes is all it takes. We’ll match you with a trusted local landscaping company that serves your area and
            specializes in your project.
          </p>
        </div>
      </div>
      <div className="container-x grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-6 sm:p-10">
          <LeadForm key={service} defaultService={service as ServiceKey | ''} defaultCity={city} />
        </div>
        <aside className="space-y-6">
          <Link
            to="/instant-quote"
            className="card flex items-start gap-4 border-gold/60 bg-gold-soft/30 p-6 transition-colors hover:bg-gold-soft/50"
          >
            <Zap className="mt-0.5 size-6 shrink-0 text-forest" />
            <div>
              <p className="font-semibold text-forest-900">Just need lawn care?</p>
              <p className="mt-1 text-sm text-muted">Measure your yard on the map and see a price in 60 seconds.</p>
            </div>
          </Link>
          <div className="card p-6">
            <p className="font-semibold text-forest-900">What happens next</p>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {[
                'We review your request and match you with a qualified local company.',
                'They contact you — usually within one business day.',
                'For install work, they schedule a free on-site estimate.',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-leaf" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
