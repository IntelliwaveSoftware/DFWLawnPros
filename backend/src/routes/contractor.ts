// Contractor portal: profile, matched leads, purchases and outcomes.
import { EXCLUSIVE_LEADS, getService, SERVICES } from '../config.js'
import { addEvent, db, isUniqueViolation, type Prisma } from '../db.js'
import type { Contractor, Lead, LeadOutcome } from '../generated/prisma/client.js'
import { body, HttpError, idParam, requireUser, type Request, type Routes } from '../http.js'
import { createCheckout, paymentsEnabled } from '../payments.js'
import { finalizePurchase } from '../purchases.js'
import { LIVE_PURCHASE } from './leads.js'

const VALID_SERVICES = new Set(SERVICES.map((s) => s.key))

const OUTCOME_EVENTS = [
  ['contacted', 'contacted'],
  ['qualified', 'qualified'],
  ['appointment_booked', 'appointment_booked'],
  ['quote_given', 'quoted'],
  ['won', 'won'],
  ['lost', 'lost'],
] as const

async function myContractor(req: Request): Promise<Contractor> {
  const user = requireUser(req)
  const c = await db().contractor.findUnique({ where: { cognito_sub: user.sub } })
  if (!c) throw new HttpError(409, 'Complete your company profile first')
  return c
}

export const UNDER_REVIEW = 'Your application is under review. We’ll email you once your company is approved.'

/** New companies apply first: leads stay hidden until an admin approves them. */
function requireApproved(c: Contractor): Contractor {
  if (!c.approved_at) throw new HttpError(403, UNDER_REVIEW)
  return c
}

/**
 * Deterministic MVP matching: the lead is available, the contractor is approved and active, serves the
 * lead's ZIP and offers the service, and (exclusive model) nobody holds a live purchase.
 */
const matchingLeads = (c: Contractor): Prisma.LeadWhereInput => ({
  status: 'available',
  zip_code: { in: c.active && c.approved_at ? c.service_area : [] },
  service: { in: c.services },
  ...(EXCLUSIVE_LEADS ? { purchases: { none: LIVE_PURCHASE } } : {}),
})

type LeadWithSummary = Lead & { enrichment: { ai_summary: string | null } | null }
const withSummary = { enrichment: { select: { ai_summary: true } } } as const

/** Contractor-facing lead. Contact details are withheld until purchase. */
function view(lead: LeadWithSummary, purchased: boolean, outcome?: LeadOutcome | null) {
  return {
    id: lead.id,
    created_at: lead.created_at,
    first_name: lead.name.trim().split(/\s+/)[0] ?? '',
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
    ai_summary: lead.enrichment?.ai_summary ?? null,
    purchased_by_me: purchased,
    ...(purchased
      ? { name: lead.name, email: lead.email, phone: lead.phone, address: lead.address, outcome: outcome ?? null }
      : {}),
  }
}

export const contractorRoutes: Routes = {
  async 'GET /contractor/profile'(req) {
    const user = requireUser(req)
    return db().contractor.findUnique({ where: { cognito_sub: user.sub } })
  },

  async 'PUT /contractor/profile'(req) {
    const user = requireUser(req)
    const data = body(req)
    const services = (Array.isArray(data.services) ? data.services : []).filter((s): s is string =>
      VALID_SERVICES.has(s as string),
    )
    const zips = [
      ...new Set(
        (Array.isArray(data.service_area) ? data.service_area : []).filter(
          (z): z is string => typeof z === 'string' && /^\d{5}$/.test(z),
        ),
      ),
    ].sort()
    const company_name = String(data.company_name ?? '').trim().slice(0, 200)
    if (!company_name || !services.length || !zips.length) {
      throw new HttpError(400, 'company_name, services and service_area are required')
    }
    const fields = {
      company_name,
      contact_name: String(data.contact_name || user.name).slice(0, 200),
      email: String(data.email || user.email).slice(0, 200),
      phone: String(data.phone ?? '').slice(0, 40),
      service_area: zips,
      services,
    }
    return db().contractor.upsert({
      where: { cognito_sub: user.sub },
      create: { cognito_sub: user.sub, ...fields },
      update: fields,
    })
  },

  async 'GET /contractor/leads/available'(req) {
    const c = requireApproved(await myContractor(req))
    const leads = await db().lead.findMany({
      where: matchingLeads(c),
      include: withSummary,
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
      take: 200,
    })
    if (leads.length) {
      // Appearing in a contractor's list counts as "presented" (one event per lead/contractor).
      await db().leadEvent.createMany({
        data: leads.map((l) => ({ lead_id: l.id, contractor_id: c.id, type: 'presented' })),
        skipDuplicates: true,
      })
    }
    return leads.map((l) => view(l, false))
  },

  async 'GET /contractor/leads/purchased'(req) {
    const c = await myContractor(req)
    const purchases = await db().leadPurchase.findMany({
      where: { contractor_id: c.id, status: 'completed' },
      orderBy: { purchased_at: 'desc' },
      include: { lead: { include: { ...withSummary, outcomes: { where: { contractor_id: c.id } } } } },
    })
    return purchases.map(({ lead }) => view(lead, true, lead.outcomes[0]))
  },

  async 'GET /contractor/leads/{id}'(req) {
    const c = await myContractor(req)
    const id = idParam(req)
    const lead = await db().lead.findUnique({
      where: { id },
      include: {
        ...withSummary,
        purchases: { where: { contractor_id: c.id, status: 'completed' }, take: 1 },
        outcomes: { where: { contractor_id: c.id } },
      },
    })
    if (!lead) throw new HttpError(404, 'Lead not found')
    const mine = lead.purchases.length > 0
    if (!mine) {
      requireApproved(c)
      const available = await db().lead.count({ where: { id, ...matchingLeads(c) } })
      if (!available) throw new HttpError(404, 'This lead is no longer available')
      await addEvent(id, 'presented', c.id)
    }
    return view(lead, mine, lead.outcomes[0])
  },

  async 'POST /contractor/leads/{id}/purchase'(req) {
    const c = requireApproved(await myContractor(req))
    const id = idParam(req)
    const lead = await db().lead.findFirst({ where: { id, ...matchingLeads(c) } })
    if (!lead) throw new HttpError(409, 'This lead is no longer available')

    let purchase
    try {
      purchase = await db().leadPurchase.create({
        data: {
          lead_id: id,
          contractor_id: c.id,
          price: lead.price,
          status: paymentsEnabled() ? 'pending_payment' : 'completed',
        },
      })
    } catch (error) {
      // lead_purchases_exclusive_idx: someone else bought it first.
      if (isUniqueViolation(error)) throw new HttpError(409, 'This lead is no longer available')
      throw error
    }

    if (!paymentsEnabled()) {
      await finalizePurchase(id, c.id, lead.price.toNumber())
      return { purchase, checkout_url: null }
    }
    const session = await createCheckout({
      purchaseId: purchase.id,
      leadId: id,
      price: lead.price.toNumber(),
      email: c.email,
      description: `${getService(lead.service)?.label ?? lead.service} lead — ${lead.city}`,
    })
    await db().leadPurchase.update({ where: { id: purchase.id }, data: { stripe_checkout_session_id: session.id } })
    return { purchase, checkout_url: session.url }
  },

  async 'PUT /contractor/leads/{id}/outcome'(req) {
    const c = await myContractor(req)
    const id = idParam(req)
    const key = { lead_id_contractor_id: { lead_id: id, contractor_id: c.id } }
    const current = await db().leadOutcome.findUnique({ where: key })
    if (!current) throw new HttpError(403, 'You have not purchased this lead')

    const data = body(req)
    const flags = Object.fromEntries(OUTCOME_EVENTS.map(([f]) => [f, Boolean(data[f])])) as Record<
      (typeof OUTCOME_EVENTS)[number][0],
      boolean
    >
    if (flags.won && flags.lost) throw new HttpError(400, "A lead can't be both won and lost")
    const raw = data.estimated_job_value
    const value = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null

    return db().$transaction(async (tx) => {
      const row = await tx.leadOutcome.update({
        where: key,
        data: {
          ...flags,
          estimated_job_value: flags.won ? value : null,
          notes: String(data.notes ?? '').slice(0, 5000),
        },
      })
      for (const [field, type] of OUTCOME_EVENTS) {
        if (flags[field] && !current[field]) {
          await addEvent(id, type, c.id, field === 'won' ? { estimated_job_value: value } : null, tx)
        }
      }
      if (flags.won || flags.lost) await tx.lead.update({ where: { id }, data: { status: 'closed' } })
      return row
    })
  },
}
