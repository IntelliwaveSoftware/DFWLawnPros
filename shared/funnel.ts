// Quote-funnel steps the website reports (anonymous: a random per-tab session id, no personal data).
// Shared so the browser, the Lambda's validation and the admin chart agree on names and order.

export const FUNNEL_STEPS = [
  ['page_view', 'Viewed quote page'],
  ['address_entered', 'Entered address'],
  ['lawn_measured', 'Measured lawn'],
  ['services_chosen', 'Chose services'],
  ['quote_submitted', 'Submitted request'],
] as const

/** Other events worth recording that aren't steps of the instant-quote funnel. */
export const OTHER_EVENTS = ['lead_form_submitted', 'callback_submitted', 'call_clicked'] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number][0]
export type TrackedEvent = FunnelStep | (typeof OTHER_EVENTS)[number]

export const TRACKED_EVENTS: readonly TrackedEvent[] = [...FUNNEL_STEPS.map(([key]) => key), ...OTHER_EVENTS]

/** Where the event happened: the ad landing page, the regular instant quote, or the project form. */
export const TRACKED_PAGES = ['landing', 'instant_quote', 'lead_form'] as const
export type TrackedPage = (typeof TRACKED_PAGES)[number]
