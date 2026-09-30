// How a lead's lifecycle is shown to people. Every event stays in the database (the full history is
// training data), but score changes from back-end processing are folded away:
//   - one "scored" entry, at the time the lead was first scored, showing the enriched score when AI
//     enrichment succeeded (otherwise the score from the customer's answers);
//   - re-scores after enrichment or a scoring-rules change are hidden (the lead's current score is shown
//     separately);
//   - re-scores because new information was entered about the lead are shown, with a note of what changed.

/** Why a lead was (re)scored. Stored on each "scored" event's payload. */
export type ScoreTrigger = 'intake' | 'enrichment' | 'rules_change' | 'lead_update'

export interface ScoredPayload {
  score: number
  rules_version: number
  trigger?: ScoreTrigger // absent on events recorded before triggers existed
  previous?: number | null
  /** lead_update only: a short description of what changed, e.g. "Phone number verified". */
  note?: string
}

interface EventLike {
  type: string
  payload: Record<string, unknown> | null
  created_at: string
}

export function displayLifecycle<E extends EventLike>(events: E[]): E[] {
  const scored = events.filter((e) => e.type === 'scored')
  const firstUpdate = scored.findIndex((e) => (e.payload as ScoredPayload | null)?.trigger === 'lead_update')
  // The value to show for the initial entry: the last intake/enrichment score before any lead update.
  // (Older events have no trigger; they're treated as intake/enrichment.)
  const initial = (firstUpdate === -1 ? scored : scored.slice(0, firstUpdate))
    .filter((e) => {
      const trigger = (e.payload as ScoredPayload | null)?.trigger
      return trigger === 'intake' || trigger === 'enrichment' || trigger === undefined
    })
    .at(-1)

  let shownInitial = false
  const out: E[] = []
  for (const e of events) {
    if (e.type !== 'scored') {
      out.push(e)
      continue
    }
    const trigger = (e.payload as ScoredPayload | null)?.trigger
    if (trigger === 'lead_update') {
      out.push(e)
    } else if (!shownInitial && trigger !== 'rules_change') {
      // The first intake/enrichment score: shown once, with the final (enriched, if any) value.
      shownInitial = true
      out.push({ ...e, payload: { ...e.payload, score: (initial?.payload as ScoredPayload | null)?.score ?? (e.payload as ScoredPayload | null)?.score } })
    }
  }
  return out
}
