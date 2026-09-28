import { getIdToken } from '@/auth/auth'
import { API_BASE_URL } from '@/config/env'
import type { LeadFilters } from '@/lib/types'
import { ApiError, type Api } from './types'

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = await getIdToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`)
  return data as T
}

const query = (filters: LeadFilters) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v))
  })
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const httpApi: Api = {
  submitLead: (lead) => request('POST', '/leads', lead, false),

  listLeads: (filters) => request('GET', `/admin/leads${query(filters)}`),
  getLead: (id) => request('GET', `/admin/leads/${id}`),
  updateLeadStatus: (id, status) => request('PATCH', `/admin/leads/${id}`, { status }),
  getAnalytics: () => request('GET', '/admin/analytics'),
  listContractors: () => request('GET', '/admin/contractors'),
  setContractorActive: (id, active) => request('PATCH', `/admin/contractors/${id}`, { active }),
  getScoringRules: () => request('GET', '/admin/scoring-rules'),
  updateScoringRules: (rules) => request('PUT', '/admin/scoring-rules', rules),

  getMyProfile: () => request('GET', '/contractor/profile'),
  saveMyProfile: (profile) => request('PUT', '/contractor/profile', profile),
  listAvailableLeads: () => request('GET', '/contractor/leads/available'),
  listPurchasedLeads: () => request('GET', '/contractor/leads/purchased'),
  getContractorLead: (id) => request('GET', `/contractor/leads/${id}`),
  purchaseLead: (id) => request('POST', `/contractor/leads/${id}/purchase`),
  updateOutcome: (leadId, outcome) => request('PUT', `/contractor/leads/${leadId}/outcome`, outcome),
}
