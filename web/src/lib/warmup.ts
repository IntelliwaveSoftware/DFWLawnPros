// Wakes the API — the Lambda and, if it has paused, the Aurora database — once a real visitor starts
// using the site, so their form submit doesn't wait for a cold start.
//
// Waits for an interaction (tap, click, key press, wheel) rather than firing on page load, so crawlers
// that run JavaScript don't wake the database. Scroll isn't used: the router scrolls programmatically.
// At most one ping per 5 minutes, shared across tabs; continued activity keeps pinging at that pace.
import { API_BASE_URL, USE_MOCK_API } from '@/config/env'

const INTERVAL_MS = 5 * 60_000
const STORAGE_KEY = 'dfwlp:warmup'
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

let lastSent = 0

/** Latest ping from any tab. Storage can be unavailable (private mode, blocked site data). */
function lastPing(): number {
  try {
    return Math.max(lastSent, Number(localStorage.getItem(STORAGE_KEY)) || 0)
  } catch {
    return lastSent
  }
}

function ping() {
  const now = Date.now()
  // In-memory check first: this runs on every key press and wheel tick.
  if (now - lastSent < INTERVAL_MS || now - lastPing() < INTERVAL_MS) return
  if (document.visibilityState !== 'visible') return
  lastSent = now
  try {
    localStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    // Fall back to this tab's in-memory timestamp.
  }
  fetch(`${API_BASE_URL}/warmup`, { cache: 'no-store' }).catch(() => {})
}

export function startWarmup() {
  if (USE_MOCK_API || navigator.webdriver) return
  for (const type of EVENTS) addEventListener(type, ping, { capture: true, passive: true })
}
