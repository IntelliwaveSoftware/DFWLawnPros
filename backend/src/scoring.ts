// Persistence around the shared scoring engine (shared/scoring.ts — same code the web app runs).
import { scoreLead, type ScoreBreakdown, type ScoringRules } from '../../shared/scoring.js'
import { DEFAULT_SCORING_RULES } from './config.js'
import { addEvent, db, isUniqueViolation, type Prisma } from './db.js'

type StoredRules = Omit<ScoringRules, 'version'>

const withVersion = (rules: Prisma.JsonValue, version: number): ScoringRules => ({
  ...(rules as unknown as StoredRules),
  version,
})

export async function activeRules(): Promise<ScoringRules> {
  const row = await db().scoringConfig.findFirst({ where: { active: true } })
  if (row) return withVersion(row.rules, row.version)
  try {
    return await saveRules(DEFAULT_SCORING_RULES, 'seed')
  } catch (error) {
    // Another invocation seeded concurrently (one-active unique index); use theirs.
    if (!isUniqueViolation(error)) throw error
    const seeded = await db().scoringConfig.findFirstOrThrow({ where: { active: true } })
    return withVersion(seeded.rules, seeded.version)
  }
}

export async function saveRules(rules: StoredRules, createdBy: string): Promise<ScoringRules> {
  const { description, rules: list } = rules
  const row = await db().$transaction(async (tx) => {
    await tx.scoringConfig.updateMany({ where: { active: true }, data: { active: false } })
    return tx.scoringConfig.create({
      data: {
        rules: { description, rules: list } as unknown as Prisma.InputJsonValue,
        active: true,
        created_by: createdBy,
      },
    })
  })
  return withVersion(row.rules, row.version)
}

/** Score a lead from its stored data + enrichment and persist the result. */
export async function rescore(leadId: string, rules?: ScoringRules): Promise<ScoreBreakdown> {
  rules ??= await activeRules()
  const lead = await db().lead.findUniqueOrThrow({ where: { id: leadId }, include: { enrichment: true } })
  const e = lead.enrichment
  const breakdown = scoreLead(
    rules,
    lead,
    e && { ...e, estimated_budget: e.estimated_budget === null ? null : e.estimated_budget.toNumber() },
  )
  await db().lead.update({
    where: { id: leadId },
    data: {
      score: breakdown.score,
      score_breakdown: breakdown as unknown as Prisma.InputJsonValue,
      // A lead becomes purchasable once it has a score.
      ...(lead.status === 'new' ? { status: 'available' } : {}),
    },
  })
  await addEvent(leadId, 'scored', null, { score: breakdown.score, rules_version: breakdown.rules_version })
  return breakdown
}
