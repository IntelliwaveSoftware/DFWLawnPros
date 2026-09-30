// AI enrichment: extract structured fields from the customer's project description.
//
// Output is stored in lead_enrichments and always labelled AI-derived. The prompt forbids
// inventing facts the customer did not state (e.g. a budget), and every inferred field is nullable.
import AnthropicAws from '@anthropic-ai/aws-sdk'
import { getBudget, getTimeframe, SERVICES } from './config.js'
import { addEvent, db, type Prisma } from './db.js'
import { rescore } from './scoring.js'

const MODEL = process.env.ENRICHMENT_MODEL ?? 'claude-opus-5'
const SERVICE_KEYS = SERVICES.map((s) => s.key)

/**
 * Claude Platform on AWS: requests are signed with the caller's AWS credentials (the Lambda's IAM role,
 * or your SSO profile locally), so there is no API key to store. Region and workspace come from
 * AWS_REGION and ANTHROPIC_AWS_WORKSPACE_ID.
 */
let client: AnthropicAws | undefined
const anthropic = () => (client ??= new AnthropicAws())

/** Without a workspace, leads are still accepted and scored; they just aren't enriched. */
export const enrichmentConfigured = () => Boolean(process.env.ANTHROPIC_AWS_WORKSPACE_ID)

export interface Extraction {
  services: string[]
  project_type: string | null
  project_size: 'small' | 'medium' | 'large' | null
  estimated_budget: number | null
  urgency: 'low' | 'medium' | 'high' | null
  intent: 'low' | 'medium' | 'high' | null
  summary: string
}

const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] })
const LEVEL = { type: 'string', enum: ['low', 'medium', 'high'] }

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    services: { type: 'array', items: { type: 'string', enum: SERVICE_KEYS } },
    project_type: nullable({ type: 'string' }),
    project_size: nullable({ type: 'string', enum: ['small', 'medium', 'large'] }),
    estimated_budget: nullable({ type: 'number' }),
    urgency: nullable(LEVEL),
    intent: nullable(LEVEL),
    summary: { type: 'string' },
  },
  required: ['services', 'project_type', 'project_size', 'estimated_budget', 'urgency', 'intent', 'summary'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You extract structured data from homeowner requests submitted to a Dallas–Fort Worth \
lawn care and landscaping lead marketplace. A landscaping company will read your output before deciding \
whether to buy the lead, so accuracy matters more than completeness.

Rules:
- Work only from what the customer wrote. Never invent facts. If something isn't stated or clearly implied, use null.
- estimated_budget: a dollar amount only when the customer states one in their description (e.g. "around $15k" -> 15000). \
Otherwise null — do not estimate a budget yourself.
- services: every service the request involves, using only these keys: ${SERVICE_KEYS.join(', ')}.
- project_type: a short phrase such as "backyard renovation", "recurring lawn maintenance", "sprinkler repair".
- project_size: small (single bed or quick job), medium (one yard or area), large (multiple areas or a full renovation).
- urgency: how soon they want the work, from their words and chosen timeframe.
- intent: how ready they seem to hire (specific scope, budget and timing = high; vague or "just researching" = low).
- summary: one or two plain sentences a contractor can skim. No marketing language, no contact details.`

interface LeadForExtraction {
  id: string
  service: string
  budget: string
  timeframe: string
  city: string
  details: Prisma.JsonValue
  project_description: string
}

/** Call Claude with a JSON-schema output format. Returns null if the model declined. */
export async function extract(lead: LeadForExtraction): Promise<(Extraction & { model: string }) | null> {
  const fields = {
    service_selected: lead.service,
    budget_selected: getBudget(lead.budget)?.label,
    timeframe_selected: getTimeframe(lead.timeframe)?.label,
    city: lead.city,
    follow_up_answers: lead.details,
    project_description: lead.project_description,
  }
  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `Extract structured data from this request:\n\n${JSON.stringify(fields, null, 2)}` },
    ],
    output_config: {
      // Short, well-specified extraction: low effort keeps latency and cost down.
      effort: 'low',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    // On a safety-classifier decline, the API retries on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  if (response.stop_reason === 'refusal') {
    console.warn(`enrichment declined for lead ${lead.id}`, response.stop_details)
    return null
  }
  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') return null
  return { ...(JSON.parse(text.text) as Extraction), model: response.model }
}

/** Enrich, store, then (re)score. Runs asynchronously after a lead is submitted. */
export async function enrichLead(leadId: string): Promise<void> {
  const lead = await db().lead.findUnique({ where: { id: leadId } })
  if (!lead) return

  let data: Awaited<ReturnType<typeof extract>> = null
  if (enrichmentConfigured()) {
    try {
      data = await extract(lead)
    } catch (error) {
      // Enrichment is best-effort: an API outage, missing IAM permission, disabled outbound identity
      // federation or a malformed response must never block the lead.
      console.error(`enrichment failed for lead ${leadId}`, error)
    }
  }

  if (data) {
    const fields = {
      extracted_services: data.services,
      project_type: data.project_type,
      estimated_project_size: data.project_size,
      estimated_budget: data.estimated_budget,
      urgency: data.urgency,
      intent: data.intent,
      ai_summary: data.summary,
      model: data.model,
      raw_output: data as unknown as Prisma.InputJsonValue,
      enrichment_timestamp: new Date(),
    }
    await db().leadEnrichment.upsert({
      where: { lead_id: leadId },
      create: { lead_id: leadId, ...fields },
      update: fields,
    })
    await addEvent(leadId, 'enriched', null, { model: data.model })
  }

  // Score even when enrichment failed — AI-dependent rules simply don't match.
  await rescore(leadId, { trigger: 'enrichment' })
}
