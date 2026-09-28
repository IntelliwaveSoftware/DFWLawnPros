import servicesConfig from '@shared/services.json'
import type { ServiceKey } from './types'

export const SERVICES = servicesConfig.services as {
  key: ServiceKey
  label: string
  high_value: boolean
  lead_price: number
}[]
export const BUDGETS = servicesConfig.budgets
export const TIMEFRAMES = servicesConfig.timeframes
export const DEFAULT_LEAD_PRICE = servicesConfig.default_lead_price
export const EXCLUSIVE_LEADS = servicesConfig.exclusive_leads

const byKey = <T extends { key: string; label: string }>(list: T[], key: string | null | undefined) =>
  list.find((x) => x.key === key)

export const serviceLabel = (key: string) => byKey(SERVICES, key)?.label ?? key
export const budgetLabel = (key: string) => byKey(BUDGETS, key)?.label ?? key
export const timeframeLabel = (key: string) => byKey(TIMEFRAMES, key)?.label ?? key
export const getService = (key: string) => byKey(SERVICES, key)
export const getBudget = (key: string) => byKey(BUDGETS, key)
export const getTimeframe = (key: string) => byKey(TIMEFRAMES, key)
export const leadPriceFor = (service: string) => getService(service)?.lead_price ?? DEFAULT_LEAD_PRICE

/**
 * Conditional, service-specific questions shown on the lead form.
 * To add questions for a service, add an entry here — answers are stored in `lead.details`.
 */
export interface ConditionalQuestion {
  key: string
  label: string
  options: { value: string; label: string }[]
}

const PROJECT_SIZE: ConditionalQuestion = {
  key: 'project_size',
  label: 'Approximate project size',
  options: [
    { value: 'small', label: 'Small (single bed or area)' },
    { value: 'medium', label: 'Medium (front or back yard)' },
    { value: 'large', label: 'Large (multiple areas)' },
    { value: 'xlarge', label: 'Whole property' },
  ],
}

const PROJECT_SCOPE: ConditionalQuestion = {
  key: 'project_scope',
  label: 'Desired project scope',
  options: [
    { value: 'refresh', label: 'Refresh / cleanup' },
    { value: 'partial', label: 'Partial redesign' },
    { value: 'full', label: 'Full renovation' },
    { value: 'new_build', label: 'New construction' },
  ],
}

const PROPERTY_SIZE: ConditionalQuestion = {
  key: 'property_size',
  label: 'Property size',
  options: [
    { value: 'small', label: 'Under 1/8 acre' },
    { value: 'medium', label: '1/8 – 1/4 acre' },
    { value: 'large', label: '1/4 – 1/2 acre' },
    { value: 'xlarge', label: '1/2 acre or more' },
  ],
}

export const CONDITIONAL_QUESTIONS: Partial<Record<ServiceKey, ConditionalQuestion[]>> = {
  lawn_care: [
    PROPERTY_SIZE,
    {
      key: 'frequency',
      label: 'Frequency needed',
      options: [
        { value: 'weekly', label: 'Weekly' },
        { value: 'biweekly', label: 'Every 2 weeks' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'one_time', label: 'One-time' },
      ],
    },
  ],
  landscaping: [PROJECT_SIZE, PROJECT_SCOPE],
  landscape_design: [PROJECT_SIZE, PROJECT_SCOPE],
  hardscaping: [
    PROJECT_SIZE,
    PROJECT_SCOPE,
    {
      key: 'hardscape_type',
      label: 'What are you building?',
      options: [
        { value: 'patio', label: 'Patio' },
        { value: 'walkway', label: 'Walkway / pathway' },
        { value: 'retaining_wall', label: 'Retaining wall' },
        { value: 'outdoor_kitchen', label: 'Outdoor kitchen / fire feature' },
        { value: 'pergola', label: 'Pergola / patio cover' },
      ],
    },
  ],
  sod: [PROPERTY_SIZE],
  artificial_turf: [PROJECT_SIZE],
  irrigation: [
    {
      key: 'irrigation_need',
      label: 'What do you need?',
      options: [
        { value: 'new_system', label: 'New sprinkler system' },
        { value: 'repair', label: 'Repair / leak' },
        { value: 'checkup', label: 'Seasonal check-up' },
        { value: 'drip', label: 'Drip irrigation for beds' },
      ],
    },
  ],
  tree_shrub: [
    {
      key: 'tree_work',
      label: 'Type of work',
      options: [
        { value: 'trimming', label: 'Trimming / pruning' },
        { value: 'removal', label: 'Removal' },
        { value: 'planting', label: 'Planting' },
        { value: 'stump', label: 'Stump grinding' },
      ],
    },
  ],
}

export const questionLabel = (service: string, key: string) =>
  CONDITIONAL_QUESTIONS[service as ServiceKey]?.find((q) => q.key === key)?.label ?? key.replace(/_/g, ' ')

export const answerLabel = (service: string, key: string, value: string) =>
  CONDITIONAL_QUESTIONS[service as ServiceKey]
    ?.find((q) => q.key === key)
    ?.options.find((o) => o.value === value)?.label ?? value
