import { ArrowLeft, Loader2, Lock, Mail, MapPin, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type OutcomeInput } from '@/api'
import { ErrorBox, KV, Loading, Panel, Provenance, ScoreBadge, useAsync } from '@/components/dashboard/ui'
import { EXCLUSIVE_LEADS, answerLabel, budgetLabel, questionLabel, serviceLabel, timeframeLabel } from '@/lib/catalog'
import { date, money, moneyRange, num } from '@/lib/format'
import type { LeadOutcome } from '@/lib/types'

const STEPS: { key: keyof OutcomeInput; label: string }[] = [
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'appointment_booked', label: 'Appointment booked' },
  { key: 'quote_given', label: 'Quote provided' },
]

const EMPTY_OUTCOME: OutcomeInput = {
  contacted: false,
  qualified: false,
  appointment_booked: false,
  quote_given: false,
  won: false,
  lost: false,
  estimated_job_value: null,
  notes: '',
}

function toInput(outcome: LeadOutcome | null | undefined): OutcomeInput {
  if (!outcome) return EMPTY_OUTCOME
  const { contacted, qualified, appointment_booked, quote_given, won, lost, estimated_job_value, notes } = outcome
  return { contacted, qualified, appointment_booked, quote_given, won, lost, estimated_job_value, notes }
}

function OutcomeForm({ leadId, outcome, onSaved }: { leadId: string; outcome: LeadOutcome | null | undefined; onSaved: () => void }) {
  const [o, setO] = useState<OutcomeInput>(() => toInput(outcome))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      await api.updateOutcome(leadId, o)
      setMsg('Saved')
      onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Lead outcome" badge={<span className="chip bg-sand text-muted">Helps us improve lead quality</span>}>
      <div className="grid gap-2 sm:grid-cols-2">
        {STEPS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 rounded-lg border border-stone px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-forest"
              checked={Boolean(o[s.key])}
              onChange={(e) => setO({ ...o, [s.key]: e.target.checked })}
            />
            {s.label}
          </label>
        ))}
      </div>
      <p className="mt-5 mb-2 text-sm font-medium">Result</p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['open', 'Still open', !o.won && !o.lost],
            ['won', 'Won the job', o.won],
            ['lost', 'Lost', o.lost],
          ] as const
        ).map(([k, label, active]) => (
          <button
            key={k}
            type="button"
            onClick={() => setO({ ...o, won: k === 'won', lost: k === 'lost', estimated_job_value: k === 'won' ? o.estimated_job_value : null })}
            className={`chip border px-4 py-1.5 text-sm ${active ? 'border-forest bg-forest text-white' : 'border-stone bg-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {o.won && (
        <label className="mt-4 block max-w-xs">
          <span className="label">Estimated / actual job value</span>
          <div className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
            <input
              className="input pl-7"
              inputMode="numeric"
              value={o.estimated_job_value ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '')
                setO({ ...o, estimated_job_value: v ? Number(v) : null })
              }}
            />
          </div>
        </label>
      )}
      <label className="mt-4 block">
        <span className="label">Notes</span>
        <textarea className="input min-h-20" value={o.notes} onChange={(e) => setO({ ...o, notes: e.target.value })} />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Save outcome
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Panel>
  )
}

export function ContractorLeadDetail() {
  const { id = '' } = useParams()
  const { data: lead, error, loading, reload } = useAsync(() => api.getContractorLead(id), [id])
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')

  if (loading && !lead) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!lead) return null

  const purchase = async () => {
    setBuying(true)
    setBuyError('')
    try {
      const result = await api.purchaseLead(lead.id)
      if (result.checkout_url) {
        window.location.href = result.checkout_url
        return
      }
      await reload()
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setBuying(false)
    }
  }

  return (
    <>
      <Link to={lead.purchased_by_me ? '/contractor/purchased' : '/contractor'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest">
        <ArrowLeft className="size-4" /> {lead.purchased_by_me ? 'My leads' : 'Available leads'}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-forest-900">
            {serviceLabel(lead.service)} in {lead.city}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {lead.city}, {lead.state} {lead.zip_code} · Submitted {date(lead.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Lead score</span> <ScoreBadge score={lead.score} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {lead.ai_summary && (
            <Panel title="Summary" badge={<Provenance kind="ai" />}>
              <p className="text-sm leading-relaxed">{lead.ai_summary}</p>
            </Panel>
          )}
          <Panel title="Project details" badge={<Provenance kind="customer" />}>
            <KV
              items={[
                ['Service', serviceLabel(lead.service)],
                ['Budget', budgetLabel(lead.budget)],
                ['Timeframe', timeframeLabel(lead.timeframe)],
                ['Location', `${lead.city}, ${lead.zip_code}`],
                ...Object.entries(lead.details)
                  .filter(([k]) => k !== 'quote_items')
                  .map(([k, v]) => [questionLabel(lead.service, k), answerLabel(lead.service, k, v)] as [string, string]),
              ]}
            />
            <p className="mt-5 text-xs text-muted">Description</p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{lead.project_description}</p>
          </Panel>
          {lead.quote && (
            <Panel title="Instant quote shown to customer" badge={<Provenance kind="system" />}>
              <p className="mb-2 text-sm text-muted">
                {num(lead.quote.lawn_sqft)} sq ft {lead.quote.measured ? '(measured on satellite map)' : '(size preset)'}
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
          {lead.purchased_by_me && <OutcomeForm key={lead.outcome?.updated_at} leadId={lead.id} outcome={lead.outcome} onSaved={reload} />}
        </div>

        <div>
          <Panel title="Contact">
            {lead.purchased_by_me ? (
              <div className="space-y-3 text-sm">
                <p className="text-lg font-semibold text-forest-900">{lead.name}</p>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-forest hover:underline">
                    <Phone className="size-4" /> {lead.phone}
                  </a>
                )}
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-forest hover:underline">
                  <Mail className="size-4" /> {lead.email}
                </a>
                {lead.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted" /> {lead.address}
                  </p>
                )}
                <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
                  Purchased{EXCLUSIVE_LEADS && ' — this lead is exclusive to you'}. Reach out quickly: response time is the
                  biggest driver of win rate.
                </p>
              </div>
            ) : (
              <div className="text-sm">
                <div className="flex items-center gap-3 rounded-xl bg-sand/70 p-4">
                  <Lock className="size-5 text-muted" />
                  <div>
                    <p className="font-medium">{lead.first_name} ••••••</p>
                    <p className="text-xs text-muted">Phone, email and address unlock after purchase.</p>
                  </div>
                </div>
                <div className="mt-5 flex items-baseline justify-between">
                  <span className="text-muted">Lead price</span>
                  <span className="font-display text-3xl text-forest-900">{money(lead.price)}</span>
                </div>
                {EXCLUSIVE_LEADS && <p className="mt-1 text-xs text-muted">Exclusive: no other company will receive this lead.</p>}
                {buyError && <p className="mt-3 text-sm text-red-700">{buyError}</p>}
                <button className="btn-gold mt-5 w-full" onClick={purchase} disabled={buying}>
                  {buying && <Loader2 className="size-4 animate-spin" />} Buy lead for {money(lead.price)}
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
