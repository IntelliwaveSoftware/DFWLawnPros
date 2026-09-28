import defaultRules from '@shared/scoring-rules.json'
import type {
  Contractor,
  Lead,
  LeadEnrichment,
  LeadEvent,
  LeadOutcome,
  LeadPurchase,
  ScoringRules,
} from '@/lib/types'
import { buildSeed } from './seed'

export interface MockUser {
  id: string
  email: string
  password: string
  name: string
  role: 'admin' | 'contractor'
}

export interface MockDb {
  version: number
  users: MockUser[]
  leads: Lead[]
  enrichments: LeadEnrichment[]
  contractors: Contractor[]
  purchases: LeadPurchase[]
  outcomes: LeadOutcome[]
  events: LeadEvent[]
  scoring_rules: ScoringRules
}

const KEY = 'dfwlp.mockdb'
const DB_VERSION = 1
let memory: MockDb | null = null

export function db(): MockDb {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as MockDb) : null
    if (parsed?.version === DB_VERSION) memory = parsed
  } catch {
    // ignore and reseed
  }
  if (!memory) {
    memory = buildSeed(defaultRules as ScoringRules)
    persist()
  }
  return memory
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    // storage full/unavailable: keep working in memory
  }
}

export function resetMockDb() {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
