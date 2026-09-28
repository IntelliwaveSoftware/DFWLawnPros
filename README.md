# DFW Lawn Pros

Lead generation and lead marketplace for lawn care & landscaping in Dallas–Fort Worth.

- **`web/`** — front-end-only React site (Vite + React 19 + TypeScript + Tailwind v4, Node 24)
  - Consumer site modeled on landscapedesignhouston.com, portfolio styled after bonicklandscaping.com
  - **Instant Quote** (DeepLawn-style): address lookup → outline the lawn on a satellite map → pick services → live price → book
  - Lead form with conditional questions and recorded consent
  - Admin dashboard (leads, search/filter, detail with provenance labels, status, analytics, contractors, scoring rules)
  - Contractor portal (profile, matched leads, purchase, outcome tracking)
- **`backend/`** — AWS Lambda (TypeScript, Node 24) the site calls instead of a server: Prisma 7 + PostgreSQL (Aurora in production), Claude enrichment, rule-based scoring, Stripe-ready purchases, Cognito auth (SAM template)
- **`shared/`** — code and config used by both: `scoring.ts` (the one scoring engine), `services.json` (services, budgets, timeframes, lead prices), `scoring-rules.json`, `pricing.json` (instant quote)

## Run locally

Two ways, neither needs AWS:

- **Demo mode** — just the web app, with an in-browser mock of the API. Quickest way to click around.
- **Full stack** — the web app talking to the real backend code and a local PostgreSQL.

### Demo mode

```bash
cd web
nvm use          # Node 24
npm install
npm run dev      # http://localhost:5173
```

With `VITE_API_BASE_URL` unset, the app uses an **in-browser mock of the Lambda API** (localStorage, seeded demo data):

| Area | URL | Demo login |
|---|---|---|
| Public site | `/`, `/portfolio`, `/instant-quote`, `/get-quote` | — |
| Admin | `/admin` | `admin@demo.com` / `demo1234` |
| Contractor portal | `/contractor` | `contractor@demo.com` / `demo1234` |

To reset demo data, clear the site's localStorage.

### Full stack (web + API + database)

Needs Docker. One-time setup:

```bash
cd backend
npm install
cp .env.example .env    # DATABASE_URL for the local Postgres; add ANTHROPIC_API_KEY for AI enrichment
npm run db:up           # PostgreSQL in Docker on :55432
npm run db:deploy       # apply migrations
npm run db:seed         # demo contractors + leads (no Claude calls)
```

Create `web/.env.local`:

```
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_AUTH_MODE=local
```

Then run each in its own terminal:

```bash
cd backend && npm run dev   # API on http://localhost:8787 (reloads on save)
cd web && npm run dev       # site on http://localhost:5173
```

| Area | URL | Sign in |
|---|---|---|
| Admin | `/login?role=admin` | any email, no password (e.g. `admin@local.test`) |
| Contractor portal | `/login?role=contractor` | `contractor@local.test` owns the seeded Greenline profile; any other email starts a new company |

How it works:
- `backend/scripts/dev-server.ts` serves the Lambda handler over HTTP, routing and enforcing auth like API Gateway
  (public routes are read from `template.yaml`).
- `VITE_AUTH_MODE=local` replaces Cognito with password-less sign-in that issues **unsigned** tokens carrying the
  same claims Cognito would. Only the local dev server accepts them; production builds ignore the setting and the
  deployed API Gateway rejects the tokens. The dev server binds to 127.0.0.1 only.
- Without `ANTHROPIC_API_KEY`, leads are still accepted and scored; the AI panel just stays empty. With a key,
  each submitted lead makes one Claude call (enrichment runs inline locally, so the submit waits for it).
- To start over: `cd backend && npx prisma migrate reset` (drops local data), then `npm run db:seed`.
- To go back to demo mode, remove `web/.env.local`.

## Deploy the backend

Prereqs: AWS SAM CLI, an Aurora PostgreSQL (or RDS PostgreSQL) database, an Anthropic API key.

```bash
cd backend
npm install
DATABASE_URL=postgresql://user:pass@host:5432/dfwlawnpros npm run db:deploy   # apply Prisma migrations
npm run deploy                                                               # esbuild bundle + sam deploy --guided
```

`npm run build` generates the Prisma client, type-checks, and bundles everything (including the shared
scoring engine and Prisma's WASM query compiler) into `dist/index.mjs` for the `nodejs24.x` runtime.
Run migrations from your deploy pipeline, not from inside the Lambda.

Then copy the stack outputs into `web/.env` (see `web/.env.example`):

```
VITE_API_BASE_URL=<ApiUrl>
VITE_COGNITO_REGION=<CognitoRegion>
VITE_COGNITO_CLIENT_ID=<CognitoClientId>
```

Create an admin: sign up a user in the Cognito pool, then
`aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> --username you@company.com --group-name admin`.
Contractors self-register at `/contractor/signup`.

**Payments:** leave `StripeSecretKey` empty and purchases complete immediately (invoice offline). Set it (plus
`StripeWebhookSecret`, webhook URL `<ApiUrl>/webhooks/stripe`, events `checkout.session.completed` and
`checkout.session.expired`) to charge via Stripe Checkout.

**Networking:** if the database is in a private VPC, add `VpcConfig` to the function and give it NAT egress
(the Lambda calls the Anthropic and Stripe APIs). Put RDS Proxy in front of Aurora once concurrency grows
(`DB_POOL_MAX` sets connections per Lambda instance; default 2). Move secrets to Secrets Manager before production.

**Schema changes:** edit `backend/prisma/schema.prisma`, then `npm run db:migrate` locally. Two partial unique
indexes (exclusive purchases, one "presented" event per contractor) are hand-written in the init migration
because Prisma's schema language can't express them.

## Tests

```bash
cd backend
npm run db:up        # local Postgres on :55432 (docker compose)
npm test             # scoring unit tests + full-lifecycle integration tests (Anthropic SDK stubbed)

cd ../web
npm run typecheck && npm run lint && npm run build
```

## Changing things without code

- **Scoring:** edit points/toggle rules on the admin *Scoring rules* page (versioned in `scoring_configs`), or change conditions in `shared/scoring-rules.json`. The engine itself (`shared/scoring.ts`) is shared by the web app and the Lambda.
- **Lead prices / services / budgets / timeframes:** `shared/services.json`.
- **Instant quote pricing:** `shared/pricing.json`.
- **Conditional questions:** `CONDITIONAL_QUESTIONS` in `web/src/lib/catalog.ts`.
- **Marketing copy, FAQs, cities, portfolio:** `web/src/content/`.

## Before launch — placeholders to replace

- Photos are Unsplash stock (`web/src/content/images.ts`, `portfolio.ts`); the before/after slider uses a filtered copy of one photo. Use real project photos.
- Reviews and hero stats in `web/src/content/site.ts` are placeholders. Use genuine, verifiable ones.
- Phone/email come from `VITE_PUBLIC_PHONE` / `VITE_PUBLIC_EMAIL` (defaults are 555 numbers).
- Privacy policy and consent text (`web/src/lib/consent.ts`) are templates. Have counsel review (TCPA).
- Satellite tiles (Esri World Imagery) and geocoding (OpenStreetMap Nominatim) are fine for development; for production traffic configure a licensed tile provider (`VITE_SATELLITE_TILE_URL`) and swap `web/src/lib/geocode.ts` to Amazon Location Service or Google Places.
- Phone verification (`leads.phone_verified`, used by scoring) has no SMS flow yet.
