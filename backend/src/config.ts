// Config shared with the web app (bundled from /shared at build time).
import defaultRules from '../../shared/scoring-rules.json'
import services from '../../shared/services.json'
import type { ScoringRules } from '../../shared/scoring.js'

export const SERVICES = services.services
export const BUDGETS = services.budgets
export const TIMEFRAMES = services.timeframes
export const EXCLUSIVE_LEADS = services.exclusive_leads
export const DEFAULT_SCORING_RULES = defaultRules as ScoringRules

const byKey = <T extends { key: string }>(list: T[], key: string) => list.find((x) => x.key === key)

export const getService = (key: string) => byKey(SERVICES, key)
export const getBudget = (key: string) => byKey(BUDGETS, key)
export const getTimeframe = (key: string) => byKey(TIMEFRAMES, key)
export const leadPriceFor = (service: string) => getService(service)?.lead_price ?? services.default_lead_price
