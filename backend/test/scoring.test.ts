// The scoring engine is shared with the web app (shared/scoring.ts); these tests pin its behaviour.
import { describe, expect, it } from 'vitest'
import { evaluate, scoreLead, type ScoringLead } from '../../shared/scoring.js'
import { DEFAULT_SCORING_RULES } from '../src/config.js'

const RULES = { ...DEFAULT_SCORING_RULES, version: 1 }

const BASE: ScoringLead = {
  name: 'Pat Doe',
  email: 'pat@example.com',
  phone: '(214) 555-0100',
  zip_code: '75024',
  phone_verified: false,
  details: {},
  quote: null,
  source: 'lead_form',
  service: 'lawn_care',
  budget: 'not_sure',
  timeframe: 'flexible',
  project_description: '',
}

describe('scoreLead', () => {
  it('scores a high-value lead at 90', () => {
    const result = scoreLead(
      RULES,
      {
        ...BASE,
        service: 'hardscaping',
        budget: '10k_25k',
        timeframe: 'within_30_days',
        details: { project_size: 'large' },
        project_description: 'x'.repeat(130),
      },
      { intent: 'high' },
    )
    expect(result.score).toBe(90)
    expect(result.matched.map((m) => m.id).sort()).toEqual(
      [
        'budget_over_10k',
        'complete_contact',
        'detailed_description',
        'high_ai_intent',
        'high_value_service',
        'large_project',
        'starts_within_30_days',
      ].sort(),
    )
  })

  it('gives a minimal lead only the contact points', () => {
    expect(scoreLead(RULES, { ...BASE, budget: 'under_1k', project_description: 'mow' }, null).score).toBe(5)
  })

  it('treats a measured lawn of 10,000+ sq ft as a large project', () => {
    const ids = scoreLead(RULES, { ...BASE, timeframe: 'asap', quote: { lawn_sqft: 12_000 } }, null).matched.map(
      (m) => m.id,
    )
    expect(ids).toContain('large_project')
    expect(ids).toContain('starts_within_30_days')
  })

  it('excludes disabled rules from the maximum', () => {
    const rules = { ...RULES, rules: RULES.rules.map((r) => ({ ...r, enabled: r.id === 'complete_contact' })) }
    expect(scoreLead(rules, { ...BASE, service: 'other' }, null).score).toBe(100)
  })
})

describe('evaluate', () => {
  it('uses strict equality and ignores non-numeric comparisons', () => {
    expect(evaluate({ field: 'x', op: 'eq', value: true }, { x: true })).toBe(true)
    expect(evaluate({ field: 'x', op: 'eq', value: true }, { x: 1 })).toBe(false)
    expect(evaluate({ field: 'x', op: 'gte', value: 10 }, { x: null })).toBe(false)
  })
})
