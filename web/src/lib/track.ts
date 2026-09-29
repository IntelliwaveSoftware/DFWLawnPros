// Quote-funnel tracking. Every step goes to our own API (anonymous: a random per-tab session id, no
// personal data) for the admin drop-off chart, and to GA4 / Meta / Google Ads when their IDs are set.
import type { TrackedEvent, TrackedPage } from '@shared/funnel'
import { api } from '@/api'
import { GA4_ID, GOOGLE_ADS_CONVERSION_LABEL, GOOGLE_ADS_ID, META_PIXEL_ID } from '@/config/env'
import { getUtm } from './utm'

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown }
    _fbq?: unknown
  }
}

export interface TrackingContext {
  page: TrackedPage
  service?: string
  city?: string
}

let context: TrackingContext = { page: 'instant_quote' }

/** Tags subsequent events with where they happened (and, on the landing page, the ad's service/city). */
export function setTrackingContext(next: TrackingContext) {
  context = next
}

function sessionId(): string {
  const key = 'dfwlp:sid'
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID().replace(/-/g, '')
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return (memorySession ??= crypto.randomUUID().replace(/-/g, ''))
  }
}
let memorySession: string | undefined

const CONVERSIONS: TrackedEvent[] = ['quote_submitted', 'lead_form_submitted', 'callback_submitted']

export function track(event: TrackedEvent) {
  const params = { page: context.page, service: context.service, city: context.city }
  window.dataLayer?.push({ event, ...params })
  window.gtag?.('event', event, params)
  if (CONVERSIONS.includes(event)) {
    if (GOOGLE_ADS_ID && GOOGLE_ADS_CONVERSION_LABEL) {
      window.gtag?.('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONVERSION_LABEL}` })
    }
    window.fbq?.('track', 'Lead', params)
  } else if (event !== 'page_view') {
    window.fbq?.('trackCustom', event, params)
  }
  // Fire and forget: tracking must never slow down or break the quote.
  void api.trackEvent({ event, session_id: sessionId(), ...params, utm: getUtm() }).catch(() => {})
}

function loadScript(src: string) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

/** Loads the ad-platform scripts whose IDs are configured. Call once at startup. */
export function initAnalytics() {
  const googleId = GA4_ID || GOOGLE_ADS_ID
  if (googleId) {
    window.dataLayer = window.dataLayer ?? []
    // gtag.js reads the `arguments` object, so this must stay a function expression.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    window.gtag('js', new Date())
    if (GA4_ID) window.gtag('config', GA4_ID)
    if (GOOGLE_ADS_ID) window.gtag('config', GOOGLE_ADS_ID)
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${googleId}`)
  }
  if (META_PIXEL_ID) {
    // Meta's standard pixel bootstrap: queue calls until fbevents.js loads.
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    } as ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown }
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.push = fbq
    window.fbq = window._fbq = fbq
    loadScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', META_PIXEL_ID)
    window.fbq('track', 'PageView')
  }
}
