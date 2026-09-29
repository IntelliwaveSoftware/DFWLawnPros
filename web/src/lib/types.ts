// Domain types. These mirror backend/prisma/schema.prisma and the Lambda API contract (backend/API.md).
import type { ScoreBreakdown } from '@shared/scoring'

export type { RuleCondition, ScoreBreakdown, ScoringRule, ScoringRules } from '@shared/scoring'

export type ServiceKey =
  | 'lawn_care'
  | 'landscaping'
  | 'landscape_design'
  | 'sod'
  | 'artificial_turf'
  | 'irrigation'
  | 'tree_shrub'
  | 'hardscaping'
  | 'other'

export type LeadStatus = 'new' | 'available' | 'purchased' | 'closed' | 'rejected'

export type LeadSource = 'lead_form' | 'instant_quote'

export interface InstantQuoteLine {
  key: string
  label: string
  unit: string
  option?: string
  low: number
  high: number
}

export interface InstantQuote {
  lawn_sqft: number
  measured: boolean
  lines: InstantQuoteLine[]
  total_low: number
  total_high: number
}

/** Payload the consumer site sends to POST /leads. Everything here is customer-provided. */
export interface LeadSubmission {
  name: string
  email: string
  /** Omitted when the customer doesn't give one; decides which consent variant applies. */
  phone?: string
  address?: string
  city: string
  state: string
  zip_code: string
  lat?: number
  lng?: number
  service: ServiceKey
  budget: string
  timeframe: string
  project_description: string
  /** Answers to conditional, service-specific questions. */
  details: Record<string, string>
  source: LeadSource
  quote?: InstantQuote
  consent: {
    accepted: true
    text: string
    timestamp: string
  }
  utm?: Record<string, string>
}

export interface Lead {
  id: string
  created_at: string
  updated_at: string
  // Customer-provided
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string
  state: string
  zip_code: string
  lat: number | null
  lng: number | null
  service: ServiceKey
  budget: string
  timeframe: string
  project_description: string
  details: Record<string, string>
  quote: InstantQuote | null
  source: LeadSource
  utm: Record<string, string> | null
  consent_timestamp: string
  consent_text: string
  // System
  status: LeadStatus
  phone_verified: boolean
  score: number | null
  score_breakdown: ScoreBreakdown | null
  price: number
}

/** AI-derived. Never authoritative for facts the customer didn't provide. */
export interface LeadEnrichment {
  lead_id: string
  extracted_services: string[]
  project_type: string | null
  estimated_project_size: 'small' | 'medium' | 'large' | null
  estimated_budget: number | null
  urgency: 'low' | 'medium' | 'high' | null
  intent: 'low' | 'medium' | 'high' | null
  ai_summary: string | null
  model: string
  enrichment_timestamp: string
}

export interface Contractor {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  /** ZIP codes served. */
  service_area: string[]
  services: ServiceKey[]
  active: boolean
  /** Null while the application is under review; the company can't see or buy leads until then. */
  approved_at: string | null
  approved_by?: string | null
  created_at: string
}

export type PurchaseStatus = 'pending_payment' | 'completed' | 'refunded' | 'cancelled'

export interface LeadPurchase {
  id: string
  lead_id: string
  contractor_id: string
  price: number
  purchased_at: string
  status: PurchaseStatus
}

export interface LeadOutcome {
  id: string
  lead_id: string
  contractor_id: string
  contacted: boolean
  qualified: boolean
  appointment_booked: boolean
  quote_given: boolean
  won: boolean
  lost: boolean
  estimated_job_value: number | null
  notes: string
  updated_at: string
}

export type LeadEventType =
  | 'generated'
  | 'enriched'
  | 'scored'
  | 'presented'
  | 'purchased'
  | 'status_changed'
  | 'contacted'
  | 'qualified'
  | 'appointment_booked'
  | 'quoted'
  | 'won'
  | 'lost'

/** Append-only lifecycle log. New outcome/event types can be added without schema changes. */
export interface LeadEvent {
  id: string
  lead_id: string
  contractor_id: string | null
  type: LeadEventType
  payload: Record<string, unknown> | null
  created_at: string
}

export interface LeadListItem extends Lead {
  purchase: (LeadPurchase & { company_name: string }) | null
}

export interface LeadDetail {
  lead: Lead
  enrichment: LeadEnrichment | null
  purchases: (LeadPurchase & { company_name: string })[]
  outcomes: (LeadOutcome & { company_name: string })[]
  events: LeadEvent[]
}

export interface LeadFilters {
  q?: string
  status?: LeadStatus | ''
  service?: ServiceKey | ''
  source?: LeadSource | ''
  min_score?: number
  purchased?: 'yes' | 'no' | ''
}

/** What a contractor sees before purchase: contact details are withheld. */
export interface ContractorLeadView {
  id: string
  created_at: string
  first_name: string
  city: string
  state: string
  zip_code: string
  service: ServiceKey
  budget: string
  timeframe: string
  project_description: string
  details: Record<string, string>
  quote: InstantQuote | null
  score: number | null
  price: number
  ai_summary: string | null
  purchased_by_me: boolean
  // Only present once purchased
  name?: string
  email?: string
  phone?: string | null
  address?: string | null
  outcome?: LeadOutcome | null
}

export interface PurchaseResult {
  purchase: LeadPurchase
  /** When payments are enabled the Lambda returns a Stripe Checkout URL to redirect to. */
  checkout_url?: string | null
}

export interface Analytics {
  totals: {
    leads: number
    avg_score: number
    leads_sold: number
    revenue: number
    conversion_rate: number
    won_jobs: number
    won_value: number
  }
  by_service: { key: string; count: number }[]
  by_city: { key: string; count: number }[]
  by_source: { key: string; count: number }[]
  by_day: { date: string; leads: number; sold: number }[]
  funnel: { stage: string; count: number }[]
  outcomes: { key: string; count: number }[]
  contractors: {
    id: string
    company_name: string
    purchases: number
    spend: number
    contacted: number
    won: number
    won_value: number
  }[]
}

export type Role = 'admin' | 'contractor'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
}
