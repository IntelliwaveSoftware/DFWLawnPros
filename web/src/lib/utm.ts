// Capture marketing attribution params on first landing so they can be attached to the lead.
const KEY = 'dfwlp.utm'
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']

export function captureUtm() {
  try {
    const search = new URLSearchParams(window.location.search)
    const found = Object.fromEntries(PARAMS.filter((p) => search.get(p)).map((p) => [p, search.get(p)!]))
    if (Object.keys(found).length) {
      found.landing_page = window.location.pathname
      found.referrer = document.referrer
      sessionStorage.setItem(KEY, JSON.stringify(found))
    }
  } catch {
    // storage unavailable
  }
}

export function getUtm(): Record<string, string> | undefined {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}
