# Lambda API contract

One API Gateway **HTTP API** → one Lambda ([`backend/src/handler.ts`](src/handler.ts), bundled to `dist/index.mjs`). JSON in, JSON out.
Authenticated routes need `Authorization: Bearer <Cognito ID token>`. Admin routes additionally
require membership in the Cognito `admin` group. Errors return `{ "message": "..." }` with a 4xx/5xx status.

Request/response types for every payload are in [`web/src/lib/types.ts`](../web/src/lib/types.ts);
the client is [`web/src/api/httpApi.ts`](../web/src/api/httpApi.ts). Money fields (`price`, `estimated_budget`,
`estimated_job_value`) are JSON numbers; lead and contractor ids are UUIDs.

## Public

| Method | Path | Body → Response |
|---|---|---|
| POST | `/leads` | `LeadSubmission` → `201 { id }`. Validates, stores, scores, then enriches asynchronously and re-scores. `phone` is optional; the consent text's version tag must match it (`2026-09-v1` with a phone, `2026-09-v3` without — see `shared/consent.ts`), otherwise `400`. |
| POST | `/events` | `{ event, page, session_id, service?, city?, utm? }` → `204`. Anonymous quote-funnel step (names in `shared/funnel.ts`); stored once per session and step for the admin funnel chart. No personal data. Throttled to 10 requests/s. |
| GET | `/warmup` | → `204`. Runs `SELECT 1` so the Lambda is warm and a paused Aurora resumes before a form submit. Called by the site on visitor activity, at most every 5 minutes per browser (`web/src/lib/warmup.ts`). Throttled to 5 requests/s. |
| POST | `/webhooks/stripe` | Stripe event (signature-verified) → `200`. Completes/cancels pending purchases. |

## Admin (`admin` group)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/leads?q=&status=&service=&source=&min_score=&purchased=yes\|no` | `LeadListItem[]` (max 500, newest first) |
| GET | `/admin/leads/{id}` | `LeadDetail` — lead, enrichment, purchases, outcomes, lifecycle events |
| PATCH | `/admin/leads/{id}` | `{ status }` → `204`; logs a `status_changed` event |
| GET | `/admin/analytics` | `Analytics` — totals, breakdowns, 30-day series, lifecycle funnel, contractor activity |
| GET | `/admin/analytics` also returns | `quote_funnel`: instant-quote sessions reaching each step in the last 30 days |
| GET | `/admin/contractors` | `Contractor[]`, applications awaiting review (`approved_at: null`) first |
| PATCH | `/admin/contractors/{id}` | `{ approved: true }` approves an application (sets `approved_at`, `approved_by`); `{ active }` pauses or resumes an approved company → `204` |
| GET | `/admin/scoring-rules` | Active `ScoringRules` (seeded from `shared/scoring-rules.json` on first call) |
| PUT | `/admin/scoring-rules` | `ScoringRules` → new active version; re-scores all `new`/`available` leads |

## Contractor (any signed-in user)

| Method | Path | Notes |
|---|---|---|
| GET | `/contractor/profile` | `Contractor` or empty body when no profile exists yet |
| PUT | `/contractor/profile` | `{ company_name, contact_name, email, phone, services[], service_area[] }` (upsert by Cognito `sub`). A new profile is an application: `approved_at` stays `null` until an admin approves it. |
| GET | `/contractor/leads/available` | Matched leads (approved + active + ZIP in service area + service offered + unsold). Contact details withheld. `403` "under review" until the company is approved (also for lead detail and purchase). |
| GET | `/contractor/leads/purchased` | Purchased leads with full contact details and current outcome |
| GET | `/contractor/leads/{id}` | `ContractorLeadView` |
| POST | `/contractor/leads/{id}/purchase` | `{ purchase, checkout_url }`. `409` if someone else got it first. With Stripe configured, redirect to `checkout_url`. |
| PUT | `/contractor/leads/{id}/outcome` | `{ contacted, qualified, appointment_booked, quote_given, won, lost, estimated_job_value, notes }` |

## Lead lifecycle events

Every transition appends to `lead_events` (`generated → enriched → scored → presented → purchased →
contacted → qualified → appointment_booked → quoted → won/lost`, plus `status_changed`).
New event types need no schema change. This log is the training data for future ML scoring.
