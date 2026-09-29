import { FUNNEL_STEPS } from '@shared/funnel'
// In-browser implementation of the Lambda API for local development and demos.
import { getSession } from '@/auth/auth'
import { EXCLUSIVE_LEADS, leadPriceFor } from '@/lib/catalog'
import { firstName } from '@/lib/format'
import type {
  Analytics,
  ContractorLeadView,
  Lead,
  LeadEventType,
  LeadListItem,
  LeadOutcome,
} from '@/lib/types'
import { ApiError, UNDER_REVIEW, type Api } from '../types'
import { contractorMatches, ingestLead, pushEvent, rescore } from './pipeline'
import { db, persist } from './store'

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()
const clone = <T,>(x: T): T => structuredClone(x)

function requireRole(role: 'admin' | 'contractor') {
  const s = getSession()
  if (!s) throw new ApiError(401, 'Not signed in')
  if (s.user.role !== role) throw new ApiError(403, 'Forbidden')
  return s.user
}

function findLead(id: string) {
  const lead = db().leads.find((l) => l.id === id)
  if (!lead) throw new ApiError(404, 'Lead not found')
  return lead
}

const companyName = (contractorId: string) =>
  db().contractors.find((c) => c.id === contractorId)?.company_name ?? 'Unknown'

const activePurchase = (leadId: string) =>
  db().purchases.find((p) => p.lead_id === leadId && (p.status === 'completed' || p.status === 'pending_payment'))

function myContractor() {
  const user = requireRole('contractor')
  const c = db().contractors.find((x) => x.id === user.id)
  if (!c) throw new ApiError(409, 'Complete your company profile first')
  return c
}

/** Same rule as the Lambda: applications see no leads until an admin approves them. */
function myApprovedContractor() {
  const c = myContractor()
  if (!c.approved_at) throw new ApiError(403, UNDER_REVIEW)
  return c
}

function toContractorView(lead: Lead, contractorId: string): ContractorLeadView {
  const d = db()
  const mine = d.purchases.some((p) => p.lead_id === lead.id && p.contractor_id === contractorId && p.status === 'completed')
  const enrichment = d.enrichments.find((e) => e.lead_id === lead.id)
  const view: ContractorLeadView = {
    id: lead.id,
    created_at: lead.created_at,
    first_name: firstName(lead.name),
    city: lead.city,
    state: lead.state,
    zip_code: lead.zip_code,
    service: lead.service,
    budget: lead.budget,
    timeframe: lead.timeframe,
    project_description: lead.project_description,
    details: lead.details,
    quote: lead.quote,
    score: lead.score,
    price: lead.price,
    ai_summary: enrichment?.ai_summary ?? null,
    purchased_by_me: mine,
  }
  if (mine) {
    Object.assign(view, {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      outcome: d.outcomes.find((o) => o.lead_id === lead.id && o.contractor_id === contractorId) ?? null,
    })
  }
  return view
}

const isAvailableTo = (lead: Lead, contractorId: string) => {
  const c = db().contractors.find((x) => x.id === contractorId)
  if (!c || !contractorMatches(c, lead) || lead.status !== 'available') return false
  return !(EXCLUSIVE_LEADS && activePurchase(lead.id))
}

function tally(keys: string[]) {
  const m = new Map<string, number>()
  keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1))
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

export const mockApi: Api = {
  async submitLead(sub) {
    await delay(600)
    const d = db()
    const at = now()
    const lead: Lead = {
      id: `L-${Date.now().toString(36).toUpperCase()}`,
      created_at: at,
      updated_at: at,
      name: sub.name.trim(),
      email: sub.email.trim(),
      phone: sub.phone?.trim() || null,
      address: sub.address ?? null,
      city: sub.city.trim(),
      state: sub.state || 'TX',
      zip_code: sub.zip_code.trim(),
      lat: sub.lat ?? null,
      lng: sub.lng ?? null,
      service: sub.service,
      budget: sub.budget,
      timeframe: sub.timeframe,
      project_description: sub.project_description.trim(),
      details: sub.details,
      quote: sub.quote ?? null,
      source: sub.source,
      utm: sub.utm ?? null,
      consent_timestamp: sub.consent.timestamp,
      consent_text: sub.consent.text,
      status: 'new',
      phone_verified: false,
      score: null,
      score_breakdown: null,
      price: leadPriceFor(sub.service),
    }
    ingestLead(d, lead)
    d.leads.sort((a, b) => b.created_at.localeCompare(a.created_at))
    persist()
    return { id: lead.id }
  },

  async listLeads(f) {
    requireRole('admin')
    await delay()
    const q = f.q?.trim().toLowerCase()
    const rows: LeadListItem[] = db()
      .leads.filter((l) => {
        if (f.status && l.status !== f.status) return false
        if (f.service && l.service !== f.service) return false
        if (f.source && l.source !== f.source) return false
        if (f.min_score && (l.score ?? 0) < f.min_score) return false
        const purchased = !!activePurchase(l.id)
        if (f.purchased === 'yes' && !purchased) return false
        if (f.purchased === 'no' && purchased) return false
        if (q) {
          const hay = [l.id, l.name, l.email, l.phone, l.city, l.zip_code, l.project_description].join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .map((l) => {
        const p = activePurchase(l.id)
        return { ...l, purchase: p ? { ...p, company_name: companyName(p.contractor_id) } : null }
      })
    return clone(rows)
  },

  async getLead(id) {
    requireRole('admin')
    await delay()
    const d = db()
    const lead = findLead(id)
    return clone({
      lead,
      enrichment: d.enrichments.find((e) => e.lead_id === id) ?? null,
      purchases: d.purchases.filter((p) => p.lead_id === id).map((p) => ({ ...p, company_name: companyName(p.contractor_id) })),
      outcomes: d.outcomes.filter((o) => o.lead_id === id).map((o) => ({ ...o, company_name: companyName(o.contractor_id) })),
      events: d.events.filter((e) => e.lead_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    })
  },

  async updateLeadStatus(id, status) {
    requireRole('admin')
    await delay()
    const lead = findLead(id)
    const from = lead.status
    lead.status = status
    lead.updated_at = now()
    pushEvent(db(), id, 'status_changed', now(), null, { from, to: status })
    persist()
  },

  async getAnalytics(): Promise<Analytics> {
    requireRole('admin')
    await delay()
    const d = db()
    const completed = d.purchases.filter((p) => p.status === 'completed')
    const scored = d.leads.filter((l) => l.score != null)
    const wonOutcomes = d.outcomes.filter((o) => o.won)
    const countEvents = (type: LeadEventType) => new Set(d.events.filter((e) => e.type === type).map((e) => e.lead_id)).size

    const days: Analytics['by_day'] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
      days.push({
        date,
        leads: d.leads.filter((l) => l.created_at.slice(0, 10) === date).length,
        sold: completed.filter((p) => p.purchased_at.slice(0, 10) === date).length,
      })
    }

    return {
      totals: {
        leads: d.leads.length,
        avg_score: scored.length ? Math.round(scored.reduce((s, l) => s + (l.score ?? 0), 0) / scored.length) : 0,
        leads_sold: completed.length,
        revenue: completed.reduce((s, p) => s + p.price, 0),
        conversion_rate: d.leads.length ? completed.length / d.leads.length : 0,
        won_jobs: wonOutcomes.length,
        won_value: wonOutcomes.reduce((s, o) => s + (o.estimated_job_value ?? 0), 0),
      },
      by_service: tally(d.leads.map((l) => l.service)),
      by_city: tally(d.leads.map((l) => l.city)),
      by_source: tally(d.leads.map((l) => l.utm?.utm_source ? `${l.source} · ${l.utm.utm_source}` : l.source)),
      by_day: days,
      funnel: [
        { stage: 'Generated', count: countEvents('generated') },
        { stage: 'Enriched', count: countEvents('enriched') },
        { stage: 'Scored', count: countEvents('scored') },
        { stage: 'Presented', count: countEvents('presented') },
        { stage: 'Purchased', count: countEvents('purchased') },
        { stage: 'Contacted', count: countEvents('contacted') },
        { stage: 'Quoted', count: countEvents('quoted') },
        { stage: 'Won', count: countEvents('won') },
      ],
      quote_funnel: FUNNEL_STEPS.map(([key, stage]) => ({
        key,
        stage,
        count: d.funnel_events.filter((e) => e.event === key && Date.parse(e.created_at) > Date.now() - 30 * 86_400_000).length,
      })),
      outcomes: [
        { key: 'Contacted', count: d.outcomes.filter((o) => o.contacted).length },
        { key: 'Qualified', count: d.outcomes.filter((o) => o.qualified).length },
        { key: 'Appointment', count: d.outcomes.filter((o) => o.appointment_booked).length },
        { key: 'Quoted', count: d.outcomes.filter((o) => o.quote_given).length },
        { key: 'Won', count: wonOutcomes.length },
        { key: 'Lost', count: d.outcomes.filter((o) => o.lost).length },
      ],
      contractors: d.contractors.map((c) => {
        const mine = completed.filter((p) => p.contractor_id === c.id)
        const outs = d.outcomes.filter((o) => o.contractor_id === c.id)
        return {
          id: c.id,
          company_name: c.company_name,
          purchases: mine.length,
          spend: mine.reduce((s, p) => s + p.price, 0),
          contacted: outs.filter((o) => o.contacted).length,
          won: outs.filter((o) => o.won).length,
          won_value: outs.reduce((s, o) => s + (o.won ? o.estimated_job_value ?? 0 : 0), 0),
        }
      }),
    }
  },

  async trackEvent(input) {
    const d = db()
    if (d.funnel_events.some((e) => e.session_id === input.session_id && e.event === input.event)) return
    d.funnel_events.push({ ...input, created_at: now() })
    persist()
  },

  async listContractors() {
    requireRole('admin')
    await delay()
    return clone(db().contractors)
  },

  async setContractorActive(id, active) {
    requireRole('admin')
    const c = db().contractors.find((x) => x.id === id)
    if (!c) throw new ApiError(404, 'Contractor not found')
    c.active = active
    persist()
  },

  async approveContractor(id) {
    const admin = requireRole('admin')
    const c = db().contractors.find((x) => x.id === id)
    if (!c) throw new ApiError(404, 'Contractor not found')
    Object.assign(c, { approved_at: now(), approved_by: admin.email, active: true })
    persist()
  },

  async getScoringRules() {
    requireRole('admin')
    return clone(db().scoring_rules)
  },

  async updateScoringRules(rules) {
    requireRole('admin')
    await delay()
    const d = db()
    d.scoring_rules = { ...rules, version: d.scoring_rules.version + 1 }
    // Re-score open leads so admins see the effect immediately.
    d.leads.filter((l) => l.status === 'available' || l.status === 'new').forEach((l) => rescore(d, l))
    persist()
    return clone(d.scoring_rules)
  },

  async getMyProfile() {
    const user = requireRole('contractor')
    await delay(100)
    return clone(db().contractors.find((c) => c.id === user.id) ?? null)
  },

  async saveMyProfile(input) {
    const user = requireRole('contractor')
    await delay()
    const d = db()
    let c = d.contractors.find((x) => x.id === user.id)
    if (c) Object.assign(c, input)
    else {
      c = { ...input, id: user.id, active: true, approved_at: null, created_at: now() }
      d.contractors.push(c)
    }
    persist()
    return clone(c)
  },

  async listAvailableLeads() {
    const c = myApprovedContractor()
    await delay()
    const d = db()
    const leads = d.leads.filter((l) => isAvailableTo(l, c.id))
    // Appearing in a contractor's list counts as "presented" (once per lead/contractor).
    const at = now()
    leads
      .filter((l) => !d.events.some((e) => e.lead_id === l.id && e.type === 'presented' && e.contractor_id === c.id))
      .forEach((l) => pushEvent(d, l.id, 'presented', at, c.id))
    persist()
    return clone(leads.map((l) => toContractorView(l, c.id)))
  },

  async listPurchasedLeads() {
    const c = myContractor()
    await delay()
    const d = db()
    const ids = new Set(d.purchases.filter((p) => p.contractor_id === c.id && p.status === 'completed').map((p) => p.lead_id))
    return clone(d.leads.filter((l) => ids.has(l.id)).map((l) => toContractorView(l, c.id)))
  },

  async getContractorLead(id) {
    const c = myContractor()
    await delay()
    const d = db()
    const lead = findLead(id)
    const view = toContractorView(lead, c.id)
    if (!view.purchased_by_me && !c.approved_at) throw new ApiError(403, UNDER_REVIEW)
    if (!view.purchased_by_me && !isAvailableTo(lead, c.id)) throw new ApiError(404, 'This lead is no longer available')
    if (!view.purchased_by_me && !d.events.some((e) => e.lead_id === id && e.type === 'presented' && e.contractor_id === c.id)) {
      pushEvent(d, id, 'presented', now(), c.id)
      persist()
    }
    return clone(view)
  },

  async purchaseLead(id) {
    const c = myApprovedContractor()
    await delay(500)
    const d = db()
    const lead = findLead(id)
    if (!isAvailableTo(lead, c.id)) throw new ApiError(409, 'This lead is no longer available')
    const at = now()
    const purchase = {
      id: crypto.randomUUID(),
      lead_id: id,
      contractor_id: c.id,
      price: lead.price,
      purchased_at: at,
      status: 'completed' as const,
    }
    d.purchases.push(purchase)
    if (EXCLUSIVE_LEADS) lead.status = 'purchased'
    lead.updated_at = at
    pushEvent(d, id, 'purchased', at, c.id, { price: lead.price })
    d.outcomes.push({
      id: crypto.randomUUID(), lead_id: id, contractor_id: c.id, contacted: false, qualified: false,
      appointment_booked: false, quote_given: false, won: false, lost: false, estimated_job_value: null,
      notes: '', updated_at: at,
    })
    persist()
    return { purchase: clone(purchase), checkout_url: null }
  },

  async updateOutcome(leadId, input) {
    const c = myContractor()
    await delay()
    const d = db()
    const outcome = d.outcomes.find((o) => o.lead_id === leadId && o.contractor_id === c.id)
    if (!outcome) throw new ApiError(403, 'You have not purchased this lead')
    const at = now()
    const eventFor: [keyof LeadOutcome, LeadEventType][] = [
      ['contacted', 'contacted'],
      ['qualified', 'qualified'],
      ['appointment_booked', 'appointment_booked'],
      ['quote_given', 'quoted'],
      ['won', 'won'],
      ['lost', 'lost'],
    ]
    for (const [field, type] of eventFor) {
      if (input[field as keyof typeof input] && !outcome[field]) {
        pushEvent(d, leadId, type, at, c.id, type === 'won' ? { estimated_job_value: input.estimated_job_value } : null)
      }
    }
    Object.assign(outcome, input, { updated_at: at })
    const lead = findLead(leadId)
    if (input.won || input.lost) {
      lead.status = 'closed'
      lead.updated_at = at
    }
    persist()
    return clone(outcome)
  },
}
