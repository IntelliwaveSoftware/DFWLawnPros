import type {
  Analytics,
  Contractor,
  ContractorLeadView,
  LeadDetail,
  LeadFilters,
  LeadListItem,
  LeadOutcome,
  LeadStatus,
  LeadSubmission,
  PurchaseResult,
  ScoringRules,
} from '@/lib/types'

export type ContractorProfileInput = Omit<Contractor, 'id' | 'created_at' | 'active'>
export type OutcomeInput = Omit<LeadOutcome, 'id' | 'lead_id' | 'contractor_id' | 'updated_at'>

/**
 * The Lambda API contract (see backend/API.md). Implemented by the HTTP client
 * (API Gateway → Lambda) and by the in-browser mock.
 */
export interface Api {
  // Public
  submitLead(lead: LeadSubmission): Promise<{ id: string }>

  // Admin (Cognito group: admin)
  listLeads(filters: LeadFilters): Promise<LeadListItem[]>
  getLead(id: string): Promise<LeadDetail>
  updateLeadStatus(id: string, status: LeadStatus): Promise<void>
  getAnalytics(): Promise<Analytics>
  listContractors(): Promise<Contractor[]>
  setContractorActive(id: string, active: boolean): Promise<void>
  getScoringRules(): Promise<ScoringRules>
  updateScoringRules(rules: ScoringRules): Promise<ScoringRules>

  // Contractor (any authenticated non-admin user)
  getMyProfile(): Promise<Contractor | null>
  saveMyProfile(profile: ContractorProfileInput): Promise<Contractor>
  listAvailableLeads(): Promise<ContractorLeadView[]>
  listPurchasedLeads(): Promise<ContractorLeadView[]>
  getContractorLead(id: string): Promise<ContractorLeadView>
  purchaseLead(id: string): Promise<PurchaseResult>
  updateOutcome(leadId: string, outcome: OutcomeInput): Promise<LeadOutcome>
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
