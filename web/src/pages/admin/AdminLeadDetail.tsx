import { ArrowLeft, Check, X } from 'lucide-react'
import { displayLifecycle } from '@shared/lifecycle'
import { Link, useParams } from 'react-router'
import { api } from '@/api'
import {
  ErrorBox,
  KV,
  Loading,
  Panel,
  Provenance,
  StatusBadge,
  useAsync,
} from '@/components/dashboard/ui'
import { answerLabel, budgetLabel, questionLabel, serviceLabel, timeframeLabel } from '@/lib/catalog'
import { dateTime, money, moneyRange, num, titleCase } from '@/lib/format'
import type { LeadStatus } from '@/lib/types'

const STATUSES: LeadStatus[] = ['new', 'available', 'purchased', 'closed', 'rejected']

const Flag = ({ on }: { on: boolean }) =>
  on ? <Check className="size-4 text-emerald-600" aria-label="Yes" /> : <X className="size-4 text-stone" aria-label="No" />

export function AdminLeadDetail() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useAsync(() => api.getLead(id), [id])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null
  const { lead, enrichment, purchases, outcomes } = data
  // Background re-scores (enrichment, rule changes) are folded into one score entry; see shared/lifecycle.ts.
  const events = displayLifecycle(data.events)

  const changeStatus = async (status: LeadStatus) => {
    await api.updateLeadStatus(lead.id, status)
    await reload()
  }

  return (
    <>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest">
        <ArrowLeft className="size-4" /> All leads
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-forest-900">{lead.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-mono">{lead.id}</span> · {dateTime(lead.created_at)} · <StatusBadge status={lead.status} />
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Status</span>
          <select className="input w-auto" value={lead.status} onChange={(e) => changeStatus(e.target.value as LeadStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Request" badge={<Provenance kind="customer" />}>
            <KV
              items={[
                ['Email', <a key="email" href={`mailto:${lead.email}`} className="text-forest hover:underline">{lead.email}</a>],
                [
                  'Phone',
                  lead.phone ? (
                    <a key="phone" href={`tel:${lead.phone}`} className="text-forest hover:underline">
                      {lead.phone}
                    </a>
                  ) : null,
                ],
                ['Address', lead.address],
                ['City / ZIP', `${lead.city}, ${lead.state} ${lead.zip_code}`],
                ['Service', serviceLabel(lead.service)],
                ['Budget', budgetLabel(lead.budget)],
                ['Timeframe', timeframeLabel(lead.timeframe)],
                ['Source', lead.source === 'instant_quote' ? 'Instant quote' : 'Lead form'],
                ...Object.entries(lead.details)
                  .filter(([k]) => k !== 'quote_items')
                  .map(([k, v]) => [questionLabel(lead.service, k), answerLabel(lead.service, k, v)] as [string, string]),
              ]}
            />
            <div className="mt-5">
              <p className="text-xs text-muted">Project description</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{lead.project_description}</p>
            </div>
            <div className="mt-5 rounded-lg bg-sand/60 p-3 text-xs text-muted">
              Consent recorded {dateTime(lead.consent_timestamp)}
              {lead.utm && <> · Attribution: {Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(', ')}</>}
            </div>
          </Panel>

          {lead.quote && (
            <Panel title="Instant quote" badge={<Provenance kind="system" />}>
              <p className="mb-3 text-sm text-muted">
                {lead.quote.measured ? 'Measured on satellite map' : 'Size preset chosen by customer'} · {num(lead.quote.lawn_sqft)} sq ft
              </p>
              <ul className="divide-y divide-stone/60 text-sm">
                {lead.quote.lines.map((l) => (
                  <li key={l.key} className="flex justify-between py-2">
                    <span>
                      {l.label}
                      {l.option && <span className="text-muted"> · {l.option}</span>}
                    </span>
                    <span className="tabular-nums">
                      {moneyRange(l.low, l.high)} <span className="text-xs text-muted">{l.unit}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="AI enrichment" badge={<Provenance kind="ai" />}>
            {enrichment ? (
              <>
                {enrichment.ai_summary && <p className="mb-4 text-sm leading-relaxed">{enrichment.ai_summary}</p>}
                <KV
                  items={[
                    ['Extracted services', enrichment.extracted_services.map(serviceLabel).join(', ')],
                    ['Project type', enrichment.project_type],
                    ['Estimated size', enrichment.estimated_project_size && titleCase(enrichment.estimated_project_size)],
                    ['Estimated budget', enrichment.estimated_budget ? money(enrichment.estimated_budget) : null],
                    ['Urgency', enrichment.urgency && titleCase(enrichment.urgency)],
                    ['Intent', enrichment.intent && titleCase(enrichment.intent)],
                  ]}
                />
                <p className="mt-4 text-xs text-muted">
                  {enrichment.model} · {dateTime(enrichment.enrichment_timestamp)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Enrichment pending.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Lead score" badge={<Provenance kind="system" />}>
            <div className="flex items-center gap-4">
              <span className="font-display text-5xl text-forest-900 tabular-nums">{lead.score ?? '—'}</span>
              <div className="text-xs text-muted">
                / 100
                {lead.score_breakdown && (
                  <>
                    <br />
                    {lead.score_breakdown.raw_points} of {lead.score_breakdown.max_points} pts · rules v{lead.score_breakdown.rules_version}
                  </>
                )}
              </div>
            </div>
            {lead.score_breakdown && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {lead.score_breakdown.matched.length === 0 && <li className="text-muted">No rules matched.</li>}
                {lead.score_breakdown.matched.map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>{m.label}</span>
                    <span className="font-semibold text-emerald-700 tabular-nums">+{m.points}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-stone/60 pt-3 text-sm">
              <span className="text-muted">Lead price</span>
              <span className="font-semibold">{money(lead.price)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Phone verified</span>
              <Flag on={lead.phone_verified} />
            </div>
          </Panel>

          <Panel title="Purchases">
            {purchases.length === 0 ? (
              <p className="text-sm text-muted">Not purchased yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {purchases.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium">{p.company_name}</span>
                      <br />
                      <span className="text-xs text-muted">{dateTime(p.purchased_at)} · {p.status}</span>
                    </span>
                    <span className="font-semibold">{money(p.price)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Outcomes" badge={<span className="chip bg-sand text-muted">Reported by contractor</span>}>
            {outcomes.length === 0 ? (
              <p className="text-sm text-muted">No outcome reported.</p>
            ) : (
              outcomes.map((o) => (
                <div key={o.id} className="text-sm">
                  <p className="mb-2 font-medium">{o.company_name}</p>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['Contacted', o.contacted],
                        ['Qualified', o.qualified],
                        ['Appointment', o.appointment_booked],
                        ['Quote given', o.quote_given],
                        ['Won', o.won],
                        ['Lost', o.lost],
                      ] as [string, boolean][]
                    ).map(([k, v]) => (
                      <li key={k} className="flex items-center gap-2">
                        <Flag on={v} /> {k}
                      </li>
                    ))}
                  </ul>
                  {o.estimated_job_value != null && (
                    <p className="mt-3">
                      Job value: <b>{money(o.estimated_job_value)}</b>
                    </p>
                  )}
                  {o.notes && <p className="mt-2 text-muted">“{o.notes}”</p>}
                  <p className="mt-2 text-xs text-muted">Updated {dateTime(o.updated_at)}</p>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Lifecycle">
            <ol className="relative space-y-3 border-l border-stone pl-5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-leaf ring-4 ring-white" />
                  <span className="font-medium">{titleCase(e.type)}</span>
                  {e.type === 'status_changed' && e.payload && (
                    <span className="text-muted"> · {String(e.payload.from)} → {String(e.payload.to)}</span>
                  )}
                  {e.type === 'scored' && e.payload && (
                    <span className="text-muted">
                      {' · '}
                      {String(e.payload.score)}
                      {e.payload.trigger === 'lead_update' && (
                        <>
                          {e.payload.previous != null && ` (was ${String(e.payload.previous)})`}
                          {e.payload.note ? ` — ${String(e.payload.note)}` : ''}
                        </>
                      )}
                    </span>
                  )}
                  <br />
                  <span className="text-xs text-muted">{dateTime(e.created_at)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  )
}
