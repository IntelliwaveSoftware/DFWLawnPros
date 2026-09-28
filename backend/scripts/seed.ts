// Seeds the LOCAL database with demo contractors and leads (fictional people, 555 numbers).
// Leads are scored with the real scoring engine; enrichment is skipped so seeding never calls Claude.
//
// Run: npm run db:seed   (refuses to run unless DATABASE_URL points at localhost)
import { leadPriceFor } from '../src/config.js'
import { addEvent, db, disconnect } from '../src/db.js'
import { finalizePurchase } from '../src/purchases.js'
import { rescore } from '../src/scoring.js'

const url = new URL(process.env.DATABASE_URL ?? '')
if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.error(`Refusing to seed a non-local database (${url.hostname}).`)
  process.exit(1)
}

// Must match the web app's local sign-in (web/src/auth/localAuth.ts): sub = "local:<email>".
const localSub = (email: string) => `local:${email}`

const CONTRACTORS = [
  {
    cognito_sub: localSub('contractor@local.test'),
    company_name: 'Legacy Lawn & Landscapes',
    contact_name: 'Tarrence Crawford',
    email: 'contractor@local.test',
    phone: '(972) 555-0101',
    service_area: ['75024', '75093', '75034', '75035', '75070', '75002'],
    services: ['lawn_care', 'artificial_turf', 'irrigation', 'landscaping', 'hardscaping'],
  },
  {
    cognito_sub: localSub('lonestar@local.test'),
    company_name: 'Crawford Signature Spaces',
    contact_name: 'Tarrence Crawford',
    email: 'lonestar@local.test',
    phone: '(214) 555-0102',
    service_area: ['75214', '75206', '75230', '75024', '75093'],
    services: ['hardscaping', 'landscape_design', 'landscaping', 'artificial_turf'],
  },
]

const LEADS = [
  ['Maria Gonzalez', 'Plano', '75024', 'hardscaping', '10k_25k', 'within_30_days', { project_size: 'large' },
    'Looking to completely redo my backyard this summer. Want a paver patio with a fire pit, new grass and some plants. Budget is around $15k.'],
  ['James Carter', 'Frisco', '75034', 'lawn_care', 'under_1k', 'asap', { frequency: 'weekly' },
    'Need weekly mowing and edging for a corner lot. Previous service stopped showing up.'],
  ['Priya Patel', 'Dallas', '75214', 'landscape_design', '25k_plus', '1_3_months', { project_size: 'xlarge', project_scope: 'full' },
    'New build with a bare backyard. Looking for a full landscape design with plantings, a patio area and lighting, installed in phases.'],
  ['Tom Nguyen', 'McKinney', '75070', 'sod', '1k_5k', 'within_30_days', { property_size: 'medium' },
    'Replacing the entire front and back lawn with zoysia sod before summer.'],
  ['Ashley Brooks', 'Allen', '75002', 'irrigation', 'under_1k', 'asap', { irrigation_need: 'repair' },
    'Sprinkler zone 3 is not turning on and there is a leak near the driveway.'],
  ['Daniel Kim', 'Plano', '75093', 'landscaping', '5k_10k', '1_3_months', { project_size: 'medium', project_scope: 'partial' },
    'Want to redo the front flower beds with new plants, mulch and river rock borders.'],
  ['Rachel Moore', 'Dallas', '75206', 'artificial_turf', '5k_10k', 'within_30_days', { project_size: 'medium' },
    'Artificial turf in the backyard for the kids and dogs, maybe a small putting green. Roughly 1,200 sq ft.'],
  ['Chris Alvarez', 'Frisco', '75035', 'lawn_care', 'not_sure', 'flexible', { frequency: 'biweekly' },
    'Just getting prices for bi-weekly mowing.'],
] as const

async function main() {
  const prisma = db()
  const existing = await prisma.lead.count()
  if (existing > 0) {
    console.log(`Database already has ${existing} leads — skipping seed. (Reset with: npx prisma migrate reset)`)
    return
  }

  const contractors = []
  for (const c of CONTRACTORS) {
    contractors.push(await prisma.contractor.upsert({ where: { cognito_sub: c.cognito_sub }, create: c, update: c }))
  }

  const now = Date.now()
  for (const [i, [name, city, zip_code, service, budget, timeframe, details, project_description]] of LEADS.entries()) {
    const created_at = new Date(now - (LEADS.length - i) * 26 * 3600_000)
    const lead = await prisma.lead.create({
      data: {
        created_at,
        name,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        phone: `(214) 555-01${String(20 + i)}`,
        city,
        zip_code,
        service,
        budget,
        timeframe,
        details,
        project_description,
        source: 'lead_form',
        consent_timestamp: created_at,
        consent_text: 'seed',
        price: leadPriceFor(service),
      },
    })
    await addEvent(lead.id, 'generated', null, { source: 'lead_form' })
    await rescore(lead.id)
  }

  // One purchased lead with an outcome, so "My leads" and analytics aren't empty.
  const first = await prisma.lead.findFirstOrThrow({ where: { name: 'Tom Nguyen' } })
  const buyer = contractors[0]
  await prisma.leadPurchase.create({ data: { lead_id: first.id, contractor_id: buyer.id, price: first.price } })
  await finalizePurchase(first.id, buyer.id, first.price.toNumber())
  await prisma.leadOutcome.update({
    where: { lead_id_contractor_id: { lead_id: first.id, contractor_id: buyer.id } },
    data: { contacted: true, appointment_booked: true },
  })
  await addEvent(first.id, 'contacted', buyer.id)
  await addEvent(first.id, 'appointment_booked', buyer.id)

  console.log(`Seeded ${contractors.length} contractors and ${LEADS.length} leads.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(disconnect)
