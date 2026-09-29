// Public: anonymous instant-quote funnel steps reported by the website. Each browser session counts
// once per step, so reloads and double clicks don't inflate the funnel.
import { TRACKED_EVENTS, TRACKED_PAGES, type TrackedEvent, type TrackedPage } from '../../../shared/funnel.js'
import { db } from '../db.js'
import { body, HttpError, json, type Routes } from '../http.js'

const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/
const short = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export const eventRoutes: Routes = {
  async 'POST /events'(req) {
    const data = body(req)
    const event = data.event as TrackedEvent
    const page = data.page as TrackedPage
    if (!TRACKED_EVENTS.includes(event)) throw new HttpError(400, 'Unknown event')
    if (!TRACKED_PAGES.includes(page)) throw new HttpError(400, 'Unknown page')
    if (typeof data.session_id !== 'string' || !SESSION_RE.test(data.session_id)) throw new HttpError(400, 'Invalid session')
    const utm =
      data.utm && typeof data.utm === 'object' && !Array.isArray(data.utm)
        ? Object.fromEntries(
            Object.entries(data.utm)
              .filter(([k]) => /^utm_[a-z]+$/.test(k))
              .slice(0, 6)
              .map(([k, v]) => [k, String(v).slice(0, 200)]),
          )
        : null
    await db().funnelEvent.createMany({
      data: [
        {
          session_id: data.session_id,
          event,
          page,
          service: short(data.service, 40),
          city: short(data.city, 60),
          ...(utm && Object.keys(utm).length ? { utm } : {}),
        },
      ],
      skipDuplicates: true,
    })
    return json(204)
  },
}
