import { ArrowRight, Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { api, isUnderReview } from '@/api'
import { Empty, ErrorBox, Loading, PageHeader, ScoreBadge, useAsync } from '@/components/dashboard/ui'
import { budgetLabel, serviceLabel, timeframeLabel } from '@/lib/catalog'
import { date, money } from '@/lib/format'
import type { ContractorLeadView } from '@/lib/types'

function NeedsProfile() {
  return (
    <Empty>
      <p className="font-semibold text-ink">Set up your company profile to start receiving leads.</p>
      <Link to="/contractor/profile" className="btn-primary mt-4">
        Complete profile
      </Link>
    </Empty>
  )
}

function UnderReview() {
  return (
    <Empty>
      <Clock className="mx-auto mb-3 size-8 text-gold" />
      <p className="font-semibold text-ink">Your application is under review</p>
      <p className="mx-auto mt-2 max-w-md">
        We review every company before it joins the network and will email you once you’re approved. Matching leads
        will appear here after that.
      </p>
      <Link to="/contractor/profile" className="btn-outline mt-5">
        Review your profile
      </Link>
    </Empty>
  )
}

function LeadCard({ lead }: { lead: ContractorLeadView }) {
  const outcome = lead.outcome
  const stage = outcome
    ? outcome.won
      ? 'Won'
      : outcome.lost
        ? 'Lost'
        : outcome.quote_given
          ? 'Quoted'
          : outcome.appointment_booked
            ? 'Appointment'
            : outcome.contacted
              ? 'Contacted'
              : 'New'
    : null
  return (
    <Link to={`/contractor/leads/${lead.id}`} className="card group block p-5 transition-shadow hover:shadow-lg hover:shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-forest-900">
            {lead.purchased_by_me ? lead.name : lead.first_name} · {serviceLabel(lead.service)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {lead.city}, {lead.zip_code} · {date(lead.created_at)}
          </p>
        </div>
        {stage ? <span className="chip bg-forest/10 text-forest">{stage}</span> : <span className="font-semibold text-forest">{money(lead.price)}</span>}
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink/80">{lead.ai_summary ?? lead.project_description}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>
          {budgetLabel(lead.budget)} · {timeframeLabel(lead.timeframe)}
          {lead.quote && ` · ${lead.quote.lawn_sqft.toLocaleString()} sq ft`}
        </span>
        <span className="flex items-center gap-3">
          <ScoreBadge score={lead.score} />
          <ArrowRight className="size-4 text-forest transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}

function LeadList({ load, empty, title, subtitle }: { load: () => Promise<ContractorLeadView[]>; empty: string; title: string; subtitle: string }) {
  const { data, error, loading } = useAsync(load)
  const needsProfile = error && /profile/i.test(error)
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {needsProfile ? (
        <NeedsProfile />
      ) : isUnderReview(error) ? (
        <UnderReview />
      ) : error ? (
        <ErrorBox message={error} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>{empty}</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
      )}
    </>
  )
}

export function AvailableLeads() {
  return (
    <LeadList
      title="Available leads"
      subtitle="Leads matching your services and service area. Contact details unlock after purchase."
      load={() => api.listAvailableLeads().then((ls) => ls.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)))}
      empty="No matching leads right now. New requests appear here as soon as they’re scored."
    />
  )
}

export function PurchasedLeads() {
  return (
    <LeadList
      title="My leads"
      subtitle="Leads you’ve purchased. Keep outcomes up to date — it improves the leads we send you."
      load={() => api.listPurchasedLeads()}
      empty="You haven’t purchased any leads yet."
    />
  )
}
