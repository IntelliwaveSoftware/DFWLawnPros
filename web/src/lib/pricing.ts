import pricing from '@shared/pricing.json'
import type { InstantQuote, InstantQuoteLine, ServiceKey } from './types'

type Pair = [number, number]

export interface PricingItem {
  key: string
  label: string
  description: string
  lead_service: ServiceKey
  unit: string
  base: Pair
  per_sqft: Pair
  min: Pair
  options?: {
    key: string
    label: string
    choices: { key: string; label: string; multiplier: number }[]
  }
}

export const PRICING_ITEMS = pricing.items as PricingItem[]
export const LAWN_SIZE_PRESETS = pricing.lawn_size_presets

const roundTo5 = (n: number) => Math.round(n / 5) * 5

export function priceLine(item: PricingItem, sqft: number, optionKey?: string): InstantQuoteLine {
  const choice = item.options?.choices.find((c) => c.key === optionKey) ?? item.options?.choices[0]
  const mult = choice?.multiplier ?? 1
  const calc = (i: 0 | 1) => roundTo5(Math.max(item.min[i], item.base[i] + item.per_sqft[i] * sqft) * mult)
  return {
    key: item.key,
    label: item.label,
    unit: item.unit,
    option: choice?.label,
    low: calc(0),
    high: calc(1),
  }
}

export function buildQuote(sqft: number, measured: boolean, selected: Record<string, string>): InstantQuote {
  const lines = PRICING_ITEMS.filter((i) => i.key in selected).map((i) => priceLine(i, sqft, selected[i.key] || undefined))
  return {
    lawn_sqft: Math.round(sqft),
    measured,
    lines,
    total_low: lines.reduce((s, l) => s + l.low, 0),
    total_high: lines.reduce((s, l) => s + l.high, 0),
  }
}

/** The lead's primary service: the highest-value category among selected quote items. */
export function primaryServiceFor(selectedKeys: string[]): ServiceKey {
  const order: ServiceKey[] = ['artificial_turf', 'sod', 'irrigation', 'lawn_care']
  const services = PRICING_ITEMS.filter((i) => selectedKeys.includes(i.key)).map((i) => i.lead_service)
  return order.find((s) => services.includes(s)) ?? 'lawn_care'
}
