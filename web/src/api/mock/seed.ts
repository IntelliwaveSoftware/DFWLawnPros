// Demo data for mock mode. All people, companies, emails and phone numbers are fictional.
import { leadPriceFor } from '@/lib/catalog'
import { buildQuote } from '@/lib/pricing'
import type { Contractor, Lead, LeadOutcome, ScoringRules, ServiceKey } from '@/lib/types'
import { contractorMatches, ingestLead, pushEvent } from './pipeline'
import type { MockDb } from './store'

export const DEMO_ADMIN = { email: 'admin@demo.com', password: 'demo1234' }
export const DEMO_CONTRACTOR = { email: 'contractor@demo.com', password: 'demo1234' }

export const DFW_ZIPS: { zip: string; city: string }[] = [
  { zip: '75214', city: 'Dallas' },
  { zip: '75206', city: 'Dallas' },
  { zip: '75230', city: 'Dallas' },
  { zip: '75024', city: 'Plano' },
  { zip: '75093', city: 'Plano' },
  { zip: '75034', city: 'Frisco' },
  { zip: '75035', city: 'Frisco' },
  { zip: '75070', city: 'McKinney' },
  { zip: '75002', city: 'Allen' },
  { zip: '75078', city: 'Prosper' },
  { zip: '75080', city: 'Richardson' },
  { zip: '75019', city: 'Coppell' },
  { zip: '75022', city: 'Flower Mound' },
  { zip: '76092', city: 'Southlake' },
  { zip: '76107', city: 'Fort Worth' },
  { zip: '76109', city: 'Fort Worth' },
  { zip: '76016', city: 'Arlington' },
  { zip: '75063', city: 'Irving' },
]

// Small seeded PRNG so the demo data is stable across reloads.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const NAMES = [
  'Maria Gonzalez', 'James Carter', 'Priya Patel', 'Tom Nguyen', 'Ashley Brooks', 'Daniel Kim', 'Rachel Moore',
  'Chris Alvarez', 'Megan Foster', 'Kevin Liu', 'Sara Whitfield', 'Marcus Reed', 'Emily Tran', 'Jordan Hayes',
  'Laura Bennett', 'Omar Haddad', 'Nicole Price', 'Ben Walker', 'Hannah Scott', 'Luis Ramirez', 'Grace Chen',
  'Tyler Morgan', 'Brianna Ellis', 'Sam Okafor',
]

const DESCRIPTIONS: Record<ServiceKey, string[]> = {
  lawn_care: [
    'Need weekly mowing and edging for a corner lot. Previous service stopped showing up.',
    'Looking for mowing plus a fertilization and weed control program. Lots of weeds in the front yard this spring.',
    'Bermuda lawn is thinning out. Want aeration and fertilization, then regular bi-weekly mowing.',
  ],
  landscaping: [
    'Want to redo the front flower beds with new plants, mulch and river rock borders. Curb appeal refresh before we list the house.',
    'Backyard needs a complete makeover — new beds along the fence, some small trees, and better drainage. Budget around $12k.',
  ],
  landscape_design: [
    'Just bought a new build in Prosper with a bare backyard. Looking for a full landscape design with plantings, a patio area and lighting. Budget is roughly $30k.',
    'Would like a designer to create a plan for the whole property that we can install in phases.',
  ],
  sod: [
    'Need new sod in the backyard after the dogs destroyed it. About 2,500 sq ft, St. Augustine preferred.',
    'Replacing the entire front and back lawn with zoysia sod. Want it done before summer.',
  ],
  artificial_turf: [
    'Want artificial turf in the backyard for the kids and dogs, maybe a small putting green. Roughly 1,200 sq ft.',
    'Shady side yard will not grow grass. Interested in synthetic turf there.',
  ],
  irrigation: [
    'Sprinkler zone 3 is not turning on and there is a leak near the driveway. Need repair ASAP.',
    'Looking to add drip irrigation to our new flower beds and check the existing system.',
  ],
  tree_shrub: [
    'Two large live oaks need trimming away from the roof, and we want the overgrown hedges shaped.',
    'Need a dead tree removed and stump ground in the front yard.',
  ],
  hardscaping: [
    'Looking to completely redo my backyard this summer. Want a patio, new grass and some plants. Budget is around $15k.',
    'Want a paver patio with a fire pit and seat wall, plus a flagstone walkway to the gate. Hoping to start within the month.',
    'Planning an outdoor kitchen and pergola off the back patio. Budget $40k, want it done before fall.',
  ],
  other: ['Need a French drain installed — water pools against the foundation every time it rains.'],
}

const SERVICE_WEIGHTS: ServiceKey[] = [
  'lawn_care', 'lawn_care', 'lawn_care', 'landscaping', 'landscaping', 'hardscaping', 'hardscaping',
  'sod', 'sod', 'artificial_turf', 'irrigation', 'irrigation', 'tree_shrub', 'landscape_design', 'other',
]

const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)]

export function buildSeed(rules: ScoringRules): MockDb {
  const r = rng(42)
  const now = Date.now()
  const day = 86_400_000
  const d: MockDb = {
    version: 1,
    users: [
      { id: 'u-admin', email: DEMO_ADMIN.email, password: DEMO_ADMIN.password, name: 'Platform Admin', role: 'admin' },
      { id: 'c-greenline', email: DEMO_CONTRACTOR.email, password: DEMO_CONTRACTOR.password, name: 'Alex Rivera', role: 'contractor' },
      { id: 'c-lonestar', email: 'lonestar@demo.com', password: 'demo1234', name: 'Dana Whitaker', role: 'contractor' },
      { id: 'c-trinity', email: 'trinity@demo.com', password: 'demo1234', name: 'Rob Castillo', role: 'contractor' },
      { id: 'c-prairie', email: 'prairie@demo.com', password: 'demo1234', name: 'Jen Holt', role: 'contractor' },
    ],
    leads: [],
    enrichments: [],
    contractors: [],
    purchases: [],
    outcomes: [],
    events: [],
    scoring_rules: rules,
  }

  const zipsFor = (...cities: string[]) => DFW_ZIPS.filter((z) => cities.includes(z.city)).map((z) => z.zip)
  const contractors: Contractor[] = [
    {
      id: 'c-greenline', company_name: 'Legacy Lawn & Landscapes', contact_name: 'Tarrence Crawford',
      email: DEMO_CONTRACTOR.email, phone: '(972) 555-0101',
      service_area: zipsFor('Plano', 'Frisco', 'Allen', 'McKinney', 'Prosper', 'Richardson'),
      services: ['lawn_care', 'sod', 'irrigation', 'landscaping', 'hardscaping'],
      active: true, created_at: new Date(now - 90 * day).toISOString(),
    },
    {
      id: 'c-lonestar', company_name: 'Crawford Signature Spaces', contact_name: 'Tarrence Crawford',
      email: 'lonestar@demo.com', phone: '(214) 555-0102',
      service_area: zipsFor('Dallas', 'Richardson', 'Plano', 'Coppell', 'Irving'),
      services: ['hardscaping', 'landscape_design', 'landscaping', 'artificial_turf', 'other'],
      active: true, created_at: new Date(now - 80 * day).toISOString(),
    },
    {
      id: 'c-trinity', company_name: 'Trinity Tree & Turf', contact_name: 'Rob Castillo',
      email: 'trinity@demo.com', phone: '(817) 555-0103',
      service_area: zipsFor('Fort Worth', 'Arlington', 'Southlake', 'Flower Mound'),
      services: ['tree_shrub', 'artificial_turf', 'lawn_care', 'sod', 'landscaping'],
      active: true, created_at: new Date(now - 70 * day).toISOString(),
    },
    {
      id: 'c-prairie', company_name: 'Prairie Irrigation Co.', contact_name: 'Jen Holt',
      email: 'prairie@demo.com', phone: '(469) 555-0104',
      service_area: DFW_ZIPS.map((z) => z.zip),
      services: ['irrigation'],
      active: false, created_at: new Date(now - 60 * day).toISOString(),
    },
  ]
  d.contractors = contractors

  const budgetsFor = (s: ServiceKey) =>
    ['hardscaping', 'landscape_design', 'artificial_turf'].includes(s)
      ? ['5k_10k', '10k_25k', '10k_25k', '25k_plus', 'not_sure']
      : ['landscaping', 'sod'].includes(s)
        ? ['1k_5k', '5k_10k', '10k_25k', 'not_sure']
        : ['under_1k', 'under_1k', '1k_5k', 'not_sure']

  for (let i = 0; i < 46; i++) {
    const service = pick(r, SERVICE_WEIGHTS)
    const area = pick(r, DFW_ZIPS)
    const name = NAMES[i % NAMES.length]
    const created = new Date(now - Math.floor(r() * 60 * day) - Math.floor(r() * day)).toISOString()
    const isQuote = service === 'lawn_care' && r() < 0.6
    const sqft = 2500 + Math.round(r() * 9000)
    const lead: Lead = {
      id: `L-${(1000 + i).toString()}`,
      created_at: created,
      updated_at: created,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      phone: `(${pick(r, ['214', '469', '972', '817'])}) 555-01${String(10 + i).padStart(2, '0')}`,
      address: isQuote ? `${100 + Math.floor(r() * 8900)} ${pick(r, ['Oak Hollow', 'Preston Meadow', 'Willow Bend', 'Cedar Ridge', 'Bluebonnet'])} Dr` : null,
      city: area.city,
      state: 'TX',
      zip_code: area.zip,
      lat: null,
      lng: null,
      service,
      budget: pick(r, budgetsFor(service)),
      timeframe: pick(r, ['asap', 'within_30_days', 'within_30_days', '1_3_months', '3_plus_months', 'flexible']),
      project_description: pick(r, DESCRIPTIONS[service]),
      details: service === 'lawn_care' ? { frequency: pick(r, ['weekly', 'biweekly']) } : ['landscaping', 'hardscaping', 'landscape_design'].includes(service) ? { project_size: pick(r, ['small', 'medium', 'large', 'xlarge']) } : {},
      quote: isQuote ? buildQuote(sqft, true, { mowing: 'weekly', ...(r() < 0.5 ? { fertilization: '' } : {}) }) : null,
      source: isQuote ? 'instant_quote' : 'lead_form',
      utm: r() < 0.4 ? { utm_source: pick(r, ['google', 'facebook', 'nextdoor']), utm_medium: 'cpc' } : null,
      consent_timestamp: created,
      consent_text: 'seed',
      status: 'new',
      phone_verified: r() < 0.35,
      score: null,
      score_breakdown: null,
      price: leadPriceFor(service),
    }
    ingestLead(d, lead)

    // Simulate marketplace activity on older leads.
    const ageDays = (now - new Date(created).getTime()) / day
    const buyer = contractors.find((c) => contractorMatches(c, lead))
    if (buyer && ageDays > 2) pushEvent(d, lead.id, 'presented', new Date(new Date(created).getTime() + 3600_000).toISOString(), buyer.id)
    if (buyer && ageDays > 2 && r() < 0.7) {
      const purchasedAt = new Date(new Date(created).getTime() + (2 + r() * 20) * 3600_000).toISOString()
      d.purchases.push({ id: `P-${i}`, lead_id: lead.id, contractor_id: buyer.id, price: lead.price, purchased_at: purchasedAt, status: 'completed' })
      lead.status = 'purchased'
      pushEvent(d, lead.id, 'purchased', purchasedAt, buyer.id, { price: lead.price })

      const outcome: LeadOutcome = {
        id: `O-${i}`, lead_id: lead.id, contractor_id: buyer.id, contacted: false, qualified: false,
        appointment_booked: false, quote_given: false, won: false, lost: false, estimated_job_value: null,
        notes: '', updated_at: purchasedAt,
      }
      const steps: (keyof LeadOutcome & ('contacted' | 'qualified' | 'appointment_booked' | 'quote_given'))[] = ['contacted', 'qualified', 'appointment_booked', 'quote_given']
      const eventFor = { contacted: 'contacted', qualified: 'qualified', appointment_booked: 'appointment_booked', quote_given: 'quoted' } as const
      let t = new Date(purchasedAt).getTime()
      for (const step of steps) {
        if (r() > 0.78) break
        t += (6 + r() * 48) * 3600_000
        if (t > now) break
        outcome[step] = true
        pushEvent(d, lead.id, eventFor[step], new Date(t).toISOString(), buyer.id)
      }
      if (outcome.quote_given && ageDays > 10) {
        const won = r() < 0.55
        outcome.won = won
        outcome.lost = !won
        if (won) {
          const b = lead.budget
          outcome.estimated_job_value = b === 'under_1k' ? 1800 : b === '1k_5k' ? 3800 : b === '5k_10k' ? 8200 : b === '10k_25k' ? 17500 : b === '25k_plus' ? 36000 : 4500
        }
        t += 72 * 3600_000
        pushEvent(d, lead.id, won ? 'won' : 'lost', new Date(Math.min(t, now)).toISOString(), buyer.id, won ? { estimated_job_value: outcome.estimated_job_value } : null)
        if (won) lead.status = 'closed'
      }
      outcome.updated_at = new Date(Math.min(t, now)).toISOString()
      d.outcomes.push(outcome)
    }
  }
  d.leads.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return d
}
