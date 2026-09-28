// End-to-end handler tests against a real PostgreSQL (see docker-compose.yml).
// The Anthropic SDK is stubbed, so tests never call the API — but the response parsing runs for real.
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const anthropicCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class Anthropic {
    static APIError = APIError
    beta = { messages: { create: anthropicCreate } }
  }
  return { default: Anthropic }
})

const { consentText } = await import('../../shared/consent.js')
const { handler } = await import('../src/handler.js')
const { db, disconnect } = await import('../src/db.js')

const ADMIN = { sub: 'admin-sub', email: 'admin@test.com', 'cognito:groups': '[admin]' }
const C1 = { sub: 'c1-sub', email: 'c1@test.com', name: 'One' }
const C2 = { sub: 'c2-sub', email: 'c2@test.com', name: 'Two' }
const C3 = { sub: 'c3-sub', email: 'c3@test.com', name: 'Three' }

async function call(
  routeKey: string,
  opts: { body?: unknown; claims?: Record<string, string>; params?: Record<string, string>; query?: Record<string, string> } = {},
) {
  const [method, path] = routeKey.split(' ')
  const event = {
    routeKey,
    rawPath: path,
    requestContext: {
      http: { method, sourceIp: '127.0.0.1' },
      ...(opts.claims ? { authorizer: { jwt: { claims: opts.claims } } } : {}),
    },
    pathParameters: opts.params,
    queryStringParameters: opts.query,
    headers: { 'user-agent': 'vitest' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as APIGatewayProxyEventV2
  const res = await handler(event)
  if (!res) throw new Error('no response')
  // Round-trip through JSON exactly as API Gateway would deliver it to the browser.
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null }
}

const LEAD = {
  name: 'Maria Gonzalez',
  email: 'maria@example.com',
  phone: '(214) 555-0199',
  city: 'Plano',
  state: 'TX',
  zip_code: '75024',
  service: 'hardscaping',
  budget: '10k_25k',
  timeframe: 'within_30_days',
  project_description:
    'Looking to completely redo my backyard this summer. Want a patio, new grass and some plants. Budget is around $15k.',
  details: { project_size: 'large' },
  source: 'lead_form',
  consent: { accepted: true, text: consentText('DFW Lawn Pros', true), timestamp: new Date().toISOString() },
}

const { phone: _omit, ...LEAD_NO_PHONE_FIELDS } = LEAD
const LEAD_NO_PHONE = {
  ...LEAD_NO_PHONE_FIELDS,
  consent: { ...LEAD.consent, text: consentText('DFW Lawn Pros', false) },
}

const extraction = {
  services: ['hardscaping', 'sod'],
  project_type: 'backyard renovation',
  project_size: 'large',
  estimated_budget: 15000,
  urgency: 'medium',
  intent: 'high',
  summary: 'Backyard patio and sod.',
}

beforeEach(async () => {
  await db().$executeRawUnsafe(
    'TRUNCATE lead_events, lead_outcomes, lead_purchases, lead_enrichments, leads, contractors, scoring_configs RESTART IDENTITY CASCADE',
  )
  anthropicCreate.mockReset()
  anthropicCreate.mockResolvedValue({
    stop_reason: 'end_turn',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: JSON.stringify(extraction) }],
  })
})

afterAll(disconnect)

describe('lead lifecycle', () => {
  it('runs intake → enrichment → scoring → matching → exclusive purchase → outcome → analytics', async () => {
    // Validation
    const bad = await call('POST /leads', { body: { ...LEAD, consent: {} } })
    expect(bad.status).toBe(400)
    expect(bad.body.message).toContain('consent')

    // Intake (enrichment runs inline outside Lambda)
    const created = await call('POST /leads', { body: LEAD })
    expect(created.status).toBe(201)
    const leadId: string = created.body.id

    const request = anthropicCreate.mock.calls[0][0]
    expect(request.model).toBe('claude-opus-5')
    expect(request.output_config.format.type).toBe('json_schema')
    expect(request.fallbacks).toBe('default')

    const detail = await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: leadId } })
    expect(detail.status).toBe(200)
    expect(detail.body.enrichment.intent).toBe('high')
    expect(detail.body.enrichment.estimated_budget).toBe(15000) // Decimal serialized as a number
    expect(detail.body.lead.status).toBe('available')
    expect(detail.body.lead.price).toBe(90)
    // 70 on customer data alone, +10 once AI intent lands. (The 115-char description is just
    // under the 120-char "detailed description" threshold.)
    expect(detail.body.lead.score).toBe(80)
    expect(detail.body.lead).not.toHaveProperty('ip_address')
    const scored = detail.body.events.filter((e: { type: string }) => e.type === 'scored')
    expect(scored.map((e: { payload: { score: number } }) => e.payload.score)).toEqual([70, 80])

    // Admin auth
    expect((await call('GET /admin/leads', { claims: C1 })).status).toBe(403)
    expect((await call('GET /admin/leads')).status).toBe(401)
    const list = await call('GET /admin/leads', { claims: ADMIN, query: { q: 'MARIA' } })
    expect(list.body).toHaveLength(1)
    expect(list.body[0].purchase).toBeNull()

    // Contractors need a profile
    expect((await call('GET /contractor/leads/available', { claims: C1 })).status).toBe(409)
    expect((await call('GET /contractor/profile', { claims: C1 })).body).toBeNull()
    const profile = { company_name: 'Greenline', services: ['hardscaping'], service_area: ['75024'], phone: '1' }
    expect((await call('PUT /contractor/profile', { claims: C1, body: profile })).status).toBe(200)
    await call('PUT /contractor/profile', { claims: C2, body: { ...profile, company_name: 'Rival' } })
    await call('PUT /contractor/profile', { claims: C3, body: { ...profile, company_name: 'Far', service_area: ['76107'] } })

    // Matching: C1 and C2 match; C3 (other ZIP) doesn't. Contact details are withheld.
    const avail = await call('GET /contractor/leads/available', { claims: C1 })
    expect(avail.body.map((l: { id: string }) => l.id)).toEqual([leadId])
    expect(avail.body[0]).not.toHaveProperty('email')
    expect(avail.body[0].ai_summary).toBe('Backyard patio and sod.')
    expect((await call('GET /contractor/leads/available', { claims: C3 })).body).toEqual([])

    // Purchase is exclusive
    const bought = await call('POST /contractor/leads/{id}/purchase', { claims: C1, params: { id: leadId } })
    expect(bought.status).toBe(200)
    expect(bought.body.purchase.status).toBe('completed')
    expect(bought.body.checkout_url).toBeNull()
    expect((await call('POST /contractor/leads/{id}/purchase', { claims: C2, params: { id: leadId } })).status).toBe(409)
    expect((await call('GET /contractor/leads/available', { claims: C2 })).body).toEqual([])

    const view = await call('GET /contractor/leads/{id}', { claims: C1, params: { id: leadId } })
    expect(view.body.purchased_by_me).toBe(true)
    expect(view.body.email).toBe('maria@example.com')
    const purchased = await call('GET /contractor/leads/purchased', { claims: C1 })
    expect(purchased.body).toHaveLength(1)

    // Outcomes
    const outcome = { contacted: true, quote_given: true, won: true, estimated_job_value: 16500, notes: 'Signed' }
    const saved = await call('PUT /contractor/leads/{id}/outcome', { claims: C1, params: { id: leadId }, body: outcome })
    expect(saved.status).toBe(200)
    expect(saved.body.won).toBe(true)
    expect(saved.body.estimated_job_value).toBe(16500)
    expect(
      (await call('PUT /contractor/leads/{id}/outcome', { claims: C2, params: { id: leadId }, body: outcome })).status,
    ).toBe(403)

    // Analytics reflect the whole lifecycle
    const stats = await call('GET /admin/analytics', { claims: ADMIN })
    expect(stats.status).toBe(200)
    expect(stats.body.totals).toMatchObject({ leads: 1, leads_sold: 1, revenue: 90, won_jobs: 1, won_value: 16500 })
    expect(Object.fromEntries(stats.body.funnel.map((f: { stage: string; count: number }) => [f.stage, f.count]))).toEqual({
      Generated: 1,
      Enriched: 1,
      Scored: 1,
      Presented: 1,
      Purchased: 1,
      Contacted: 1,
      Quoted: 1,
      Won: 1,
    })
    expect(stats.body.by_day).toHaveLength(30)
    expect(stats.body.contractors.find((c: { company_name: string }) => c.company_name === 'Greenline')).toMatchObject({
      purchases: 1,
      spend: 90,
      won: 1,
    })
  })

  it('versions scoring rules and re-scores open leads', async () => {
    const { body: created } = await call('POST /leads', { body: LEAD })
    const { body: rules } = await call('GET /admin/scoring-rules', { claims: ADMIN })
    expect(rules.version).toBe(1)
    rules.rules = rules.rules.map((r: { id: string; enabled: boolean }) => ({ ...r, enabled: r.id === 'complete_contact' }))
    const saved = await call('PUT /admin/scoring-rules', { claims: ADMIN, body: rules })
    expect(saved.body.version).toBe(2)
    const detail = await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: created.id } })
    expect(detail.body.lead.score).toBe(100)
  })

  it('still scores a lead when the model declines to enrich it', async () => {
    anthropicCreate.mockResolvedValue({ stop_reason: 'refusal', stop_details: null, model: 'claude-opus-5', content: [] })
    const { body } = await call('POST /leads', { body: LEAD })
    const detail = await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: body.id } })
    expect(detail.body.enrichment).toBeNull()
    expect(detail.body.lead.score).toBe(70)
  })

  it('enforces exclusive purchases in the database when two buyers race past the availability check', async () => {
    const { isUniqueViolation } = await import('../src/db.js')
    const { body } = await call('POST /leads', { body: LEAD })
    const [a, b] = await Promise.all(
      ['race-a', 'race-b'].map((sub) =>
        db().contractor.create({ data: { cognito_sub: sub, company_name: sub, contact_name: sub, email: `${sub}@t.com` } }),
      ),
    )
    await db().leadPurchase.create({ data: { lead_id: body.id, contractor_id: a.id, price: 90, status: 'pending_payment' } })
    const second = db().leadPurchase.create({ data: { lead_id: body.id, contractor_id: b.id, price: 90 } })
    const error = await second.catch((e: unknown) => e)
    expect(isUniqueViolation(error)).toBe(true)
  })

  it('accepts and scores a lead when enrichment throws (e.g. no ANTHROPIC_API_KEY)', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    anthropicCreate.mockRejectedValue(new Error('Could not resolve authentication method'))
    const created = await call('POST /leads', { body: LEAD })
    expect(created.status).toBe(201)
    const detail = await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: created.body.id } })
    expect(detail.body.enrichment).toBeNull()
    expect(detail.body.lead.status).toBe('available')
    expect(detail.body.lead.score).toBe(70)
    expect(detail.body.events.filter((e: { type: string }) => e.type === 'scored')).toHaveLength(2)
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })

  it('accepts a lead without a phone number under the no-phone consent', async () => {
    const created = await call('POST /leads', { body: LEAD_NO_PHONE })
    expect(created.status).toBe(201)
    const detail = await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: created.body.id } })
    expect(detail.body.lead.phone).toBeNull()
    expect(detail.body.lead.consent_text).toContain('[2026-09-v3]')
    expect(detail.body.lead.consent_text).not.toContain('text message')
    expect(detail.body.lead.consent_text).not.toContain('Message and data rates')
    // No phone → contact info is incomplete, so the 5-point rule doesn't match (80 - 5).
    expect(detail.body.lead.score).toBe(75)

    // Contractors see the lead, and after purchase get a null phone rather than an error.
    await call('PUT /contractor/profile', {
      claims: C1,
      body: { company_name: 'Greenline', services: ['hardscaping'], service_area: ['75024'] },
    })
    await call('POST /contractor/leads/{id}/purchase', { claims: C1, params: { id: created.body.id } })
    const view = await call('GET /contractor/leads/{id}', { claims: C1, params: { id: created.body.id } })
    expect(view.body.phone).toBeNull()
    expect(view.body.email).toBe('maria@example.com')
  })

  it('stores the phone-consent wording with a phone number', async () => {
    const created = await call('POST /leads', { body: LEAD })
    const detail = await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: created.body.id } })
    expect(detail.body.lead.phone).toBe('(214) 555-0199')
    expect(detail.body.lead.consent_text).toContain('[2026-09-v1]')
    expect(detail.body.lead.consent_text).toContain('phone, text message or email')
  })

  it('rejects consent that does not match whether a phone number was given', async () => {
    const phoneWithoutPhoneConsent = await call('POST /leads', { body: { ...LEAD, consent: LEAD_NO_PHONE.consent } })
    expect(phoneWithoutPhoneConsent.status).toBe(400)
    expect(phoneWithoutPhoneConsent.body.message).toContain('consent')
    const noPhoneWithPhoneConsent = await call('POST /leads', { body: { ...LEAD_NO_PHONE, consent: LEAD.consent } })
    expect(noPhoneWithPhoneConsent.status).toBe(400)
    // A phone field that's present but too short is still invalid.
    expect((await call('POST /leads', { body: { ...LEAD, phone: '555-01' } })).status).toBe(400)
    expect(await db().lead.count()).toBe(0)
  })

  it('returns 404 for unknown routes and non-UUID ids', async () => {
    expect((await call('GET /nope')).status).toBe(404)
    expect((await call('GET /admin/leads/{id}', { claims: ADMIN, params: { id: 'L-1000' } })).status).toBe(404)
  })
})
