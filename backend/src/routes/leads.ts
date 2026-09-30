// Public lead intake + admin lead management.
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { CONSENT_VERSIONS, consentVersionOf, hasPhoneNumber } from '../../../shared/consent.js'
import { BUDGETS, leadPriceFor, SERVICES, TIMEFRAMES } from '../config.js'
import { addEvent, db, Prisma } from '../db.js'
import { enrichLead } from '../enrichment.js'
import type { LeadStatus } from '../generated/prisma/client.js'
import { body, HttpError, idParam, isUuid, json, requireAdmin, str, type Routes } from '../http.js'
import { activeRules, rescore, saveRules } from '../scoring.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STATUSES: LeadStatus[] = ['new', 'available', 'purchased', 'closed', 'rejected']
export const LIVE_PURCHASE: Prisma.LeadPurchaseWhereInput = { status: { in: ['pending_payment', 'completed'] } }

const keys = (list: { key: string }[]) => new Set(list.map((x) => x.key))
const SERVICE_KEYS = keys(SERVICES)
const BUDGET_KEYS = keys(BUDGETS)
const TIMEFRAME_KEYS = keys(TIMEFRAMES)

const jsonSize = (v: unknown) => JSON.stringify(v).length
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function stringMap(value: unknown, keyLen: number, valueLen: number): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k.slice(0, keyLen), String(v).slice(0, valueLen)]),
  )
}

export function validateSubmission(data: Record<string, unknown>) {
  const lead = {
    name: str(data, 'name', 120),
    email: str(data, 'email', 200),
    phone: str(data, 'phone', 40, false) || null,
    address: str(data, 'address', 300, false) || null,
    city: str(data, 'city', 100),
    state: (str(data, 'state', 2, false) || 'TX').toUpperCase(),
    zip_code: str(data, 'zip_code', 10),
    service: str(data, 'service', 40),
    budget: str(data, 'budget', 40),
    timeframe: str(data, 'timeframe', 40),
    project_description: str(data, 'project_description', 5000),
    source: str(data, 'source', 40),
  }
  if (!EMAIL_RE.test(lead.email)) throw new HttpError(400, 'email is invalid')
  if (lead.phone !== null && (!hasPhoneNumber(lead.phone) || lead.phone.replace(/\D/g, '').length < 10)) {
    throw new HttpError(400, 'phone is invalid')
  }
  if (!/^\d{5}$/.test(lead.zip_code)) throw new HttpError(400, 'zip_code must be 5 digits')
  if (!SERVICE_KEYS.has(lead.service)) throw new HttpError(400, 'service is invalid')
  if (!BUDGET_KEYS.has(lead.budget)) throw new HttpError(400, 'budget is invalid')
  if (!TIMEFRAME_KEYS.has(lead.timeframe)) throw new HttpError(400, 'timeframe is invalid')
  if (lead.source !== 'lead_form' && lead.source !== 'instant_quote') throw new HttpError(400, 'source is invalid')

  const consent = (data.consent ?? {}) as Record<string, unknown>
  const consentAt = new Date(String(consent.timestamp ?? ''))
  if (consent.accepted !== true || !consent.text || Number.isNaN(consentAt.getTime())) {
    throw new HttpError(400, 'consent is required')
  }
  // A phone number may only be stored with consent that covers calls and texts.
  const expectedVersion = lead.phone ? CONSENT_VERSIONS.withPhone : CONSENT_VERSIONS.withoutPhone
  if (consentVersionOf(String(consent.text)) !== expectedVersion) {
    throw new HttpError(400, 'consent does not match the contact details provided')
  }

  if (data.details !== undefined && jsonSize(data.details) > 4000) throw new HttpError(400, 'details is invalid')
  const quote = data.quote ?? null
  if (quote !== null && (typeof quote !== 'object' || Array.isArray(quote) || jsonSize(quote) > 10_000)) {
    throw new HttpError(400, 'quote is invalid')
  }
  const utm = data.utm && typeof data.utm === 'object' ? stringMap(data.utm, 40, 300) : null

  return {
    ...lead,
    source: lead.source as 'lead_form' | 'instant_quote',
    details: stringMap(data.details, 60, 200),
    quote: quote as Prisma.InputJsonValue | null,
    utm,
    lat: num(data.lat),
    lng: num(data.lng),
    consent_text: String(consent.text).slice(0, 2000),
    consent_timestamp: consentAt,
  }
}

let lambda: LambdaClient | undefined

/** Enrichment calls an LLM, so run it asynchronously by re-invoking this function. */
async function startEnrichment(leadId: string): Promise<void> {
  const fn = process.env.AWS_LAMBDA_FUNCTION_NAME
  if (!fn) return enrichLead(leadId) // local dev / tests: run inline
  lambda ??= new LambdaClient({})
  await lambda.send(
    new InvokeCommand({
      FunctionName: fn,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({ task: 'enrich', lead_id: leadId })),
    }),
  )
}

const withCompany = <T extends { contractor: { company_name: string } }>({ contractor, ...rest }: T) => ({
  ...rest,
  company_name: contractor.company_name,
})

export const leadRoutes: Routes = {
  async 'POST /leads'(req) {
    const { quote, utm, ...lead } = validateSubmission(body(req))
    const row = await db().lead.create({
      data: {
        ...lead,
        quote: quote ?? Prisma.DbNull,
        utm: utm ?? Prisma.DbNull,
        ip_address: req.sourceIp,
        user_agent: (req.headers['user-agent'] ?? '').slice(0, 500),
        price: leadPriceFor(lead.service),
      },
      select: { id: true },
    })
    await addEvent(row.id, 'generated', null, { source: lead.source })
    // Score immediately on customer data so the lead is usable even before enrichment lands.
    await rescore(row.id, { trigger: 'intake' })
    await startEnrichment(row.id)
    return json(201, { id: row.id })
  },

  async 'GET /admin/leads'(req) {
    requireAdmin(req)
    const q = req.query
    const where: Prisma.LeadWhereInput = {}
    if (STATUSES.includes(q.status as LeadStatus)) where.status = q.status as LeadStatus
    if (q.service) where.service = q.service
    if (q.source === 'lead_form' || q.source === 'instant_quote') where.source = q.source
    if (/^\d+$/.test(q.min_score ?? '')) where.score = { gte: Number(q.min_score) }
    if (q.purchased === 'yes') where.purchases = { some: LIVE_PURCHASE }
    if (q.purchased === 'no') where.purchases = { none: LIVE_PURCHASE }
    const term = q.q?.trim()
    if (term) {
      const like = { contains: term, mode: 'insensitive' } as const
      where.OR = [
        { name: like },
        { email: like },
        { phone: like },
        { city: like },
        { zip_code: like },
        { project_description: like },
        ...(isUuid(term) ? [{ id: term }] : []),
      ]
    }
    const rows = await db().lead.findMany({
      where,
      omit: { ip_address: true, user_agent: true },
      include: {
        purchases: {
          where: LIVE_PURCHASE,
          orderBy: { purchased_at: 'desc' },
          take: 1,
          include: { contractor: { select: { company_name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    })
    return rows.map(({ purchases, ...lead }) => ({ ...lead, purchase: purchases[0] ? withCompany(purchases[0]) : null }))
  },

  async 'GET /admin/leads/{id}'(req) {
    requireAdmin(req)
    const id = idParam(req)
    const lead = await db().lead.findUnique({
      where: { id },
      omit: { ip_address: true, user_agent: true },
      include: {
        enrichment: true,
        purchases: { orderBy: { purchased_at: 'asc' }, include: { contractor: { select: { company_name: true } } } },
        outcomes: { include: { contractor: { select: { company_name: true } } } },
        events: { orderBy: [{ created_at: 'asc' }, { id: 'asc' }] },
      },
    })
    if (!lead) throw new HttpError(404, 'Lead not found')
    const { enrichment, purchases, outcomes, events, ...rest } = lead
    return {
      lead: rest,
      enrichment,
      purchases: purchases.map(withCompany),
      outcomes: outcomes.map(withCompany),
      events,
    }
  },

  async 'PATCH /admin/leads/{id}'(req) {
    const user = requireAdmin(req)
    const id = idParam(req)
    const status = body(req).status as LeadStatus
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status')
    const current = await db().lead.findUnique({ where: { id }, select: { status: true } })
    if (!current) throw new HttpError(404, 'Lead not found')
    await db().lead.update({ where: { id }, data: { status } })
    await addEvent(id, 'status_changed', null, { from: current.status, to: status, by: user.email })
    return json(204)
  },

  async 'GET /admin/scoring-rules'(req) {
    requireAdmin(req)
    return activeRules()
  },

  async 'PUT /admin/scoring-rules'(req) {
    const user = requireAdmin(req)
    const data = body(req)
    const rules = data.rules
    if (!Array.isArray(rules) || rules.length === 0) throw new HttpError(400, 'rules must be a non-empty list')
    for (const r of rules) {
      if (!r || typeof r !== 'object' || !['id', 'label', 'points', 'condition'].every((k) => k in r)) {
        throw new HttpError(400, 'each rule needs id, label, points, condition')
      }
      if (typeof r.points !== 'number' || r.points < 0 || r.points > 100) {
        throw new HttpError(400, 'points must be between 0 and 100')
      }
    }
    const saved = await saveRules(
      { description: typeof data.description === 'string' ? data.description : '', rules },
      user.email,
    )
    const open = await db().lead.findMany({ where: { status: { in: ['new', 'available'] } }, select: { id: true } })
    for (const { id } of open) await rescore(id, { trigger: 'rules_change', rules: saved })
    return saved
  },
}
