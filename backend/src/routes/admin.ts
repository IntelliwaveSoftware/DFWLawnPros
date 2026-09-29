// Admin analytics and contractor management.
import { FUNNEL_STEPS } from '../../../shared/funnel.js'
import { db } from '../db.js'
import { body, HttpError, idParam, json, requireAdmin, type Routes } from '../http.js'

const FUNNEL = [
  ['Generated', 'generated'],
  ['Enriched', 'enriched'],
  ['Scored', 'scored'],
  ['Presented', 'presented'],
  ['Purchased', 'purchased'],
  ['Contacted', 'contacted'],
  ['Quoted', 'quoted'],
  ['Won', 'won'],
] as const

const toNum = (v: unknown) => Number(v ?? 0)
const tally = (rows: { key: string | null; _count: { _all: number } }[]) =>
  rows.map((r) => ({ key: r.key ?? 'unknown', count: r._count._all })).sort((a, b) => b.count - a.count)

export const adminRoutes: Routes = {
  async 'GET /admin/analytics'(req) {
    requireAdmin(req)
    const prisma = db()
    const completed = { status: 'completed' } as const

    const [leads, avgScore, sold, won, byService, byCity, bySource, byDay, funnel, outcomes, contractors, quoteSteps] =
      await Promise.all([
        prisma.lead.count(),
        prisma.lead.aggregate({ _avg: { score: true } }),
        prisma.leadPurchase.aggregate({ where: completed, _count: { _all: true }, _sum: { price: true } }),
        prisma.leadOutcome.aggregate({ where: { won: true }, _count: { _all: true }, _sum: { estimated_job_value: true } }),
        prisma.lead.groupBy({ by: ['service'], _count: { _all: true } }),
        prisma.lead.groupBy({ by: ['city'], _count: { _all: true } }),
        prisma.$queryRaw<{ key: string; count: number }[]>`
          SELECT CASE WHEN utm->>'utm_source' IS NOT NULL THEN source::text || ' · ' || (utm->>'utm_source')
                      ELSE source::text END AS key,
                 count(*)::int AS count
          FROM leads GROUP BY 1 ORDER BY 2 DESC`,
        prisma.$queryRaw<{ date: string; leads: number; sold: number }[]>`
          SELECT to_char(d, 'YYYY-MM-DD') AS date,
                 (SELECT count(*)::int FROM leads WHERE created_at::date = d::date) AS leads,
                 (SELECT count(*)::int FROM lead_purchases
                    WHERE status = 'completed' AND purchased_at::date = d::date) AS sold
          FROM generate_series(current_date - 29, current_date, interval '1 day') d ORDER BY 1`,
        prisma.$queryRaw<{ type: string; count: number }[]>`
          SELECT type, count(DISTINCT lead_id)::int AS count FROM lead_events GROUP BY type`,
        prisma.$queryRaw<Record<string, number>[]>`
          SELECT count(*) FILTER (WHERE contacted)::int AS contacted,
                 count(*) FILTER (WHERE qualified)::int AS qualified,
                 count(*) FILTER (WHERE appointment_booked)::int AS appointment,
                 count(*) FILTER (WHERE quote_given)::int AS quoted,
                 count(*) FILTER (WHERE won)::int AS won,
                 count(*) FILTER (WHERE lost)::int AS lost
          FROM lead_outcomes`,
        prisma.$queryRaw<Record<string, unknown>[]>`
          SELECT c.id, c.company_name,
                 count(p.id) FILTER (WHERE p.status = 'completed')::int AS purchases,
                 coalesce(sum(p.price) FILTER (WHERE p.status = 'completed'), 0)::float8 AS spend,
                 (SELECT count(*)::int FROM lead_outcomes o WHERE o.contractor_id = c.id AND o.contacted) AS contacted,
                 (SELECT count(*)::int FROM lead_outcomes o WHERE o.contractor_id = c.id AND o.won) AS won,
                 (SELECT coalesce(sum(estimated_job_value), 0)::float8 FROM lead_outcomes o
                   WHERE o.contractor_id = c.id AND o.won) AS won_value
          FROM contractors c LEFT JOIN lead_purchases p ON p.contractor_id = c.id
          GROUP BY c.id ORDER BY purchases DESC`,
        // Instant-quote funnel: sessions reaching each step in the last 30 days.
        prisma.$queryRaw<{ event: string; count: number }[]>`
          SELECT event, count(*)::int AS count FROM funnel_events
          WHERE created_at > now() - interval '30 days' GROUP BY event`,
      ])

    const eventCounts = Object.fromEntries(funnel.map((r) => [r.type, r.count]))
    const o = outcomes[0] ?? {}
    return {
      totals: {
        leads,
        avg_score: Math.round(avgScore._avg.score ?? 0),
        leads_sold: sold._count._all,
        revenue: toNum(sold._sum.price),
        conversion_rate: leads ? sold._count._all / leads : 0,
        won_jobs: won._count._all,
        won_value: toNum(won._sum.estimated_job_value),
      },
      by_service: tally(byService.map((r) => ({ key: r.service, _count: r._count }))),
      by_city: tally(byCity.map((r) => ({ key: r.city, _count: r._count }))).slice(0, 20),
      by_source: bySource,
      by_day: byDay,
      funnel: FUNNEL.map(([stage, type]) => ({ stage, count: eventCounts[type] ?? 0 })),
      outcomes: [
        ['Contacted', 'contacted'],
        ['Qualified', 'qualified'],
        ['Appointment', 'appointment'],
        ['Quoted', 'quoted'],
        ['Won', 'won'],
        ['Lost', 'lost'],
      ].map(([key, col]) => ({ key, count: o[col] ?? 0 })),
      contractors,
      quote_funnel: FUNNEL_STEPS.map(([key, stage]) => ({
        key,
        stage,
        count: quoteSteps.find((r) => r.event === key)?.count ?? 0,
      })),
    }
  },

  async 'GET /admin/contractors'(req) {
    requireAdmin(req)
    // Applications waiting for review first, then everyone else, newest first.
    return db().contractor.findMany({ orderBy: [{ approved_at: { sort: 'desc', nulls: 'first' } }, { created_at: 'desc' }] })
  },

  /** `{ approved: true }` approves an application; `{ active }` pauses or resumes an approved company. */
  async 'PATCH /admin/contractors/{id}'(req) {
    const user = requireAdmin(req)
    const id = idParam(req)
    const { active, approved } = body(req)
    if (active !== undefined && typeof active !== 'boolean') throw new HttpError(400, 'active must be a boolean')
    if (approved !== undefined && approved !== true) throw new HttpError(400, 'approved can only be set to true')
    if (active === undefined && approved === undefined) throw new HttpError(400, 'Nothing to update')
    const { count } = await db().contractor.updateMany({
      where: { id },
      data: {
        ...(approved ? { approved_at: new Date(), approved_by: user.email, active: true } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })
    if (!count) throw new HttpError(404, 'Contractor not found')
    return json(204)
  },
}
