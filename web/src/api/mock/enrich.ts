// Mock-mode stand-in for the LLM enrichment the Lambda performs (backend/src/enrichment.ts).
// Keyword heuristics only — good enough to exercise the UI and scoring rules.
import type { Lead, LeadEnrichment } from '@/lib/types'

const KEYWORDS: Record<string, string[]> = {
  hardscaping: ['patio', 'paver', 'retaining wall', 'walkway', 'flagstone', 'fire pit', 'outdoor kitchen', 'pergola'],
  sod: ['sod', 'new grass', 'bermuda', 'zoysia', 'st. augustine', 'st augustine'],
  artificial_turf: ['turf', 'artificial', 'synthetic', 'putting green'],
  irrigation: ['sprinkler', 'irrigation', 'drip', 'leak', 'zone'],
  tree_shrub: ['tree', 'shrub', 'hedge', 'prune', 'stump', 'trim'],
  lawn_care: ['mow', 'mowing', 'fertiliz', 'weed', 'aerat', 'lawn care'],
  landscaping: ['plants', 'flower bed', 'beds', 'mulch', 'landscap', 'plantings', 'rock'],
  landscape_design: ['design', 'plan', 'redo', 'makeover', 'renovat'],
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w))

export function mockEnrich(lead: Lead): LeadEnrichment {
  const text = lead.project_description.toLowerCase()
  const services = Object.entries(KEYWORDS)
    .filter(([, words]) => has(text, words))
    .map(([k]) => k)
  if (!services.includes(lead.service)) services.unshift(lead.service)

  const dollar = text.match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k)?/)
  const estimated_budget = dollar
    ? Math.round(parseFloat(dollar[1].replace(/,/g, '')) * (dollar[2] ? 1000 : 1))
    : null

  const big = has(text, ['entire', 'whole', 'complete', 'full', 'backyard', 'redo', 'renovat']) || services.length >= 3
  const small = has(text, ['small', 'minor', 'quick', 'one-time', 'single'])
  const estimated_project_size = big ? 'large' : small ? 'small' : 'medium'

  const urgentWords = has(text, ['asap', 'urgent', 'this week', 'right away'])
  const urgency =
    urgentWords || lead.timeframe === 'asap' ? 'high' : lead.timeframe === 'within_30_days' ? 'medium' : 'low'

  const researching = has(text, ['just looking', 'curious', 'researching', 'idea', 'maybe'])
  const intent =
    researching || lead.timeframe === 'flexible'
      ? 'low'
      : lead.project_description.length > 100 || estimated_budget
        ? 'high'
        : 'medium'

  const project_type = has(text, ['backyard'])
    ? 'backyard renovation'
    : has(text, ['front yard', 'curb'])
      ? 'front yard refresh'
      : services.includes('lawn_care')
        ? 'recurring lawn maintenance'
        : `${services[0]?.replace(/_/g, ' ')} project`

  return {
    lead_id: lead.id,
    extracted_services: services,
    project_type,
    estimated_project_size,
    estimated_budget,
    urgency,
    intent,
    ai_summary: `${lead.city} homeowner seeking ${services
      .slice(0, 3)
      .map((s) => s.replace(/_/g, ' '))
      .join(', ')}. ${estimated_budget ? `Mentions a budget near $${estimated_budget.toLocaleString()}. ` : ''}${
      urgency === 'high' ? 'Wants to start soon.' : 'Timing is flexible.'
    }`,
    model: 'mock-heuristic',
    enrichment_timestamp: new Date().toISOString(),
  }
}
