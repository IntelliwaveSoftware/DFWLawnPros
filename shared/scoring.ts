// Rule-driven lead scoring, shared by the web app (mock mode, admin preview) and the Lambda.
// Rules are data (scoring-rules.json, versioned in the scoring_configs table), so points and
// conditions change without code changes. This file must stay dependency-free.
import services from './services.json'

export type RuleCondition =
  | { field: string; op: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'gt' | 'lt' | 'present'; value?: unknown }
  | { any: RuleCondition[] }
  | { all: RuleCondition[] }

export interface ScoringRule {
  id: string
  label: string
  points: number
  enabled: boolean
  condition: RuleCondition
}

export interface ScoringRules {
  version: number
  description?: string
  rules: ScoringRule[]
}

export interface ScoreBreakdown {
  rules_version: number
  raw_points: number
  max_points: number
  score: number
  matched: { id: string; label: string; points: number }[]
  calculated_at: string
}

/** The lead fields scoring reads. Both the web `Lead` type and Prisma rows satisfy this. */
export interface ScoringLead {
  name: string
  email: string
  phone: string | null
  zip_code: string
  service: string
  budget: string
  timeframe: string
  project_description: string
  phone_verified: boolean
  source: string
  details: unknown
  quote: unknown
}

/** AI-derived fields rules may reference as `enrichment.<field>`. */
export interface ScoringEnrichment {
  estimated_project_size?: string | null
  estimated_budget?: number | null
  urgency?: string | null
  intent?: string | null
  extracted_services?: string[]
}

export type Facts = Record<string, unknown>

const find = <T extends { key: string }>(list: T[], key: string) => list.find((x) => x.key === key)

/** Flatten a lead + enrichment into the fact names that rules reference. */
export function buildFacts(lead: ScoringLead, enrichment: ScoringEnrichment | null): Facts {
  const quote = lead.quote as { lawn_sqft?: number } | null
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    zip_code: lead.zip_code,
    service: lead.service,
    service_high_value: find(services.services, lead.service)?.high_value ?? false,
    budget: lead.budget,
    budget_min: find(services.budgets, lead.budget)?.min ?? null,
    timeframe: lead.timeframe,
    timeframe_days: find(services.timeframes, lead.timeframe)?.days ?? null,
    description_length: lead.project_description.trim().length,
    phone_verified: lead.phone_verified,
    lawn_sqft: quote?.lawn_sqft ?? null,
    source: lead.source,
    details: lead.details ?? {},
    enrichment: enrichment ?? {},
  }
}

function lookup(facts: Facts, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key]
    return undefined
  }, facts)
}

export function evaluate(cond: RuleCondition, facts: Facts): boolean {
  if ('any' in cond) return cond.any.some((c) => evaluate(c, facts))
  if ('all' in cond) return cond.all.every((c) => evaluate(c, facts))
  const actual = lookup(facts, cond.field)
  const expected = cond.value
  switch (cond.op) {
    case 'present':
      return actual !== null && actual !== undefined && String(actual).trim() !== ''
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'in':
      return Array.isArray(expected) && expected.includes(actual)
    case 'gte':
      return typeof actual === 'number' && actual >= (expected as number)
    case 'gt':
      return typeof actual === 'number' && actual > (expected as number)
    case 'lte':
      return typeof actual === 'number' && actual <= (expected as number)
    case 'lt':
      return typeof actual === 'number' && actual < (expected as number)
    default:
      return false
  }
}

export function scoreLead(
  rules: ScoringRules,
  lead: ScoringLead,
  enrichment: ScoringEnrichment | null,
): ScoreBreakdown {
  const facts = buildFacts(lead, enrichment)
  const enabled = rules.rules.filter((r) => r.enabled)
  const max = enabled.reduce((sum, r) => sum + Math.max(0, r.points), 0)
  const matched = enabled.filter((r) => evaluate(r.condition, facts))
  const raw = matched.reduce((sum, r) => sum + r.points, 0)
  return {
    rules_version: rules.version,
    raw_points: raw,
    max_points: max,
    score: max > 0 ? Math.max(0, Math.min(100, Math.round((raw / max) * 100))) : 0,
    matched: matched.map(({ id, label, points }) => ({ id, label, points })),
    calculated_at: new Date().toISOString(),
  }
}
