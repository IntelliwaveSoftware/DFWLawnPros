// Mirrors the Lambda's lead pipeline: store → enrich → score → make available.
import type { ScoredPayload, ScoreTrigger } from '@shared/lifecycle'
import { scoreLead } from '@shared/scoring'
import type { Contractor, Lead, LeadEventType } from '@/lib/types'
import { mockEnrich } from './enrich'
import type { MockDb } from './store'

export function pushEvent(
  d: MockDb,
  lead_id: string,
  type: LeadEventType,
  at: string,
  contractor_id: string | null = null,
  payload: Record<string, unknown> | null = null,
) {
  d.events.push({ id: crypto.randomUUID(), lead_id, contractor_id, type, payload, created_at: at })
}

const plus = (iso: string, seconds: number) => new Date(new Date(iso).getTime() + seconds * 1000).toISOString()

export function ingestLead(d: MockDb, lead: Lead) {
  d.leads.push(lead)
  pushEvent(d, lead.id, 'generated', lead.created_at, null, { source: lead.source })
  rescore(d, lead, 'intake', plus(lead.created_at, 1))
  lead.status = 'available'

  const enrichment = { ...mockEnrich(lead), enrichment_timestamp: plus(lead.created_at, 4) }
  d.enrichments.push(enrichment)
  pushEvent(d, lead.id, 'enriched', enrichment.enrichment_timestamp, null, { model: enrichment.model })
  rescore(d, lead, 'enrichment', plus(lead.created_at, 5))
}

/** Same as the Lambda's rescore: the trigger is recorded so the lifecycle can hide back-end re-scores. */
export function rescore(d: MockDb, lead: Lead, trigger: ScoreTrigger, at = new Date().toISOString(), note?: string) {
  const enrichment = d.enrichments.find((e) => e.lead_id === lead.id) ?? null
  const breakdown = { ...scoreLead(d.scoring_rules, lead, enrichment), calculated_at: at }
  const previous = lead.score_breakdown
  lead.score = breakdown.score
  lead.score_breakdown = breakdown
  lead.updated_at = at
  // Same rule as the Lambda: record a new or changed score; new lead information is always recorded.
  const changed = !previous || previous.score !== breakdown.score || previous.rules_version !== breakdown.rules_version
  if (changed || trigger === 'lead_update') {
    const payload: ScoredPayload = {
      score: breakdown.score,
      rules_version: breakdown.rules_version,
      trigger,
      previous: previous?.score ?? null,
      ...(note ? { note } : {}),
    }
    pushEvent(d, lead.id, 'scored', at, null, { ...payload })
  }
}

/** Deterministic MVP matching: active + serves the ZIP + offers the service. */
export const contractorMatches = (c: Contractor, lead: Lead) =>
  c.active && !!c.approved_at && c.service_area.includes(lead.zip_code) && c.services.includes(lead.service)
