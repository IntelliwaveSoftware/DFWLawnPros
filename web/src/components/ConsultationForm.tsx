// The "request a consultation" project form with its "what happens next" sidebar. Used on the project
// page (/get-quote) and on the landscaping version of the ad landing page.
import { Check, Zap } from 'lucide-react'
import { Link } from 'react-router'
import { LeadForm } from '@/components/LeadForm'
import type { ServiceKey } from '@/lib/types'

export function ConsultationForm({
  service = '',
  city = '',
  showInstantQuote = true,
}: {
  service?: ServiceKey | ''
  city?: string
  /** Link to the instant quote for lawn-care visitors (hidden where it would lead away from an ad page). */
  showInstantQuote?: boolean
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div className="card p-6 sm:p-10">
        <LeadForm key={service} defaultService={service} defaultCity={city} />
      </div>
      <aside className="space-y-6">
        {showInstantQuote && (
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
        )}
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
  )
}
