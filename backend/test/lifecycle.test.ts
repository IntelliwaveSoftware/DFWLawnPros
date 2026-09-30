import { describe, expect, it } from 'vitest'
import { displayLifecycle } from '../../shared/lifecycle.js'

let t = 0
const ev = (type: string, payload: Record<string, unknown> | null = null) => ({
  type,
  payload,
  created_at: new Date(Date.UTC(2026, 8, 30, 12, 0, t++)).toISOString(),
})
const shown = (events: ReturnType<typeof ev>[]) =>
  displayLifecycle(events).map((e) => (e.type === 'scored' ? `scored ${e.payload?.score}${e.payload?.note ? ` (${e.payload.note})` : ''}` : e.type))

describe('displayLifecycle', () => {
  it('shows one score at intake time, with the enriched value', () => {
    const events = [
      ev('generated'),
      ev('scored', { score: 45, trigger: 'intake' }),
      ev('enriched'),
      ev('scored', { score: 70, trigger: 'enrichment' }),
    ]
    expect(shown(events)).toEqual(['generated', 'scored 70', 'enriched'])
    expect(displayLifecycle(events)[1].created_at).toBe(events[1].created_at)
  })

  it('shows the customer-data score when enrichment added nothing or failed', () => {
    expect(shown([ev('generated'), ev('scored', { score: 45, trigger: 'intake' })])).toEqual(['generated', 'scored 45'])
  })

  it('hides re-scores from scoring-rules changes', () => {
    expect(
      shown([ev('generated'), ev('scored', { score: 45, trigger: 'intake' }), ev('scored', { score: 60, trigger: 'rules_change' })]),
    ).toEqual(['generated', 'scored 45'])
  })

  it('shows re-scores from new lead information, with the note', () => {
    expect(
      shown([
        ev('generated'),
        ev('scored', { score: 45, trigger: 'intake' }),
        ev('enriched'),
        ev('scored', { score: 70, trigger: 'enrichment' }),
        ev('scored', { score: 80, trigger: 'lead_update', note: 'Phone number verified' }),
        ev('purchased'),
      ]),
    ).toEqual(['generated', 'scored 70', 'enriched', 'scored 80 (Phone number verified)', 'purchased'])
  })

  it('folds older events without a trigger into one entry', () => {
    expect(shown([ev('generated'), ev('scored', { score: 45 }), ev('scored', { score: 45 }), ev('enriched'), ev('scored', { score: 70 })])).toEqual([
      'generated',
      'scored 70',
      'enriched',
    ])
  })
})
