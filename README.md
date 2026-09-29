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
cp .env.example .env    # DATABASE_URL for the local Postgres; add ANTHROPIC_AWS_WORKSPACE_ID for AI enrichment
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
- Without `ANTHROPIC_AWS_WORKSPACE_ID`, leads are still accepted and scored; the AI panel just stays empty. With it
  (and an active `aws sso login`), each submitted lead makes one Claude call through Claude Platform on AWS
  (enrichment runs inline locally, so the submit waits for it).
- To start over: `cd backend && npx prisma migrate reset` (drops local data), then `npm run db:seed`.
- To go back to demo mode, remove `web/.env.local`.

## Deploy the backend

Prereqs: AWS SAM CLI and an Aurora PostgreSQL (or RDS PostgreSQL) database. For AI enrichment, a
[Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws)
workspace in the stack's region (pass it as `AnthropicWorkspaceId`); the Lambda calls Claude with its own IAM
role, so there is no API key. Without a workspace, leads are still accepted and scored.

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

**Admins.** Pass `AdminEmail` (the pipeline uses the `ADMIN_EMAIL` secret) and the stack creates that user in the
`admin` group. Cognito emails them a temporary password; at first sign-in on `/login?role=admin` the site asks them
to choose their own. If the invitation expires (7 days), resend it with
`aws cognito-idp admin-create-user --user-pool-id <UserPoolId> --username <email> --message-action RESEND`.
To add more admins, create a user the same way (`admin-create-user`, without `--message-action`), then
`aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> --username <email> --group-name admin`.
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

## Continuous deployment (GitHub Actions)

Two workflows run on every pull request and deploy on every push to `main`. Each only runs when its own code
(or `shared/`) changes:

| Workflow | Pull request | Push to `main` |
| --- | --- | --- |
| [backend.yml](.github/workflows/backend.yml) | build + tests against a Postgres service | `prisma migrate deploy`, then `sam deploy` of `backend/template.yaml` |
| [web.yml](.github/workflows/web.yml) | lint + build | build against the API stack's outputs, upload to S3, invalidate CloudFront |

GitHub gets short-lived AWS credentials through OIDC; no AWS keys are stored in GitHub. Only jobs in the
`production` GitHub environment can assume the deploy role.

**One-time setup**

1. Edit [infra/config.json](infra/config.json): AWS region, stack names, GitHub repo, and optionally a custom
   domain (`domain.names` plus an ACM `certificateArn` in us-east-1). Under `buckets`:

   | `buckets.site` / `buckets.artifacts` | What setup does |
   | --- | --- |
   | `""` (default) | Creates the bucket with a generated name |
   | a name that doesn't exist yet | Creates the bucket with that name (names are global across AWS) |
   | a name that exists in your account and region | Reuses it. If a reused site bucket already has a bucket policy, setup leaves the policy alone and prints the one statement to add so CloudFront can read the site. |

2. With admin AWS credentials, run the setup ([infra/setup.mjs](infra/setup.mjs), which deploys
   [infra/bootstrap.yaml](infra/bootstrap.yaml)). It's safe to re-run after changing the config:

   ```bash
   node infra/setup.mjs --dry-run   # show what would be reused or created; changes nothing
   node infra/setup.mjs --github    # deploy, then copy the outputs into the GitHub environment's variables
   ```

   Without `--github`, set the variables by hand from the printed outputs. Buckets that setup creates stay
   part of the stack, so a later run keeps them; renaming one isn't supported. It also reuses an existing
   GitHub OIDC provider in the account.

   For AI enrichment, first subscribe to **Claude Platform on AWS** in the AWS Console and create a workspace in
   the same region, then put its ID (`wrkspc_…`) in `anthropicWorkspaceId`. Setup turns on the account's
   outbound web identity federation (off by default; Claude Platform on AWS needs it) and sets the
   `ANTHROPIC_AWS_WORKSPACE_ID` variable. Leave it empty to deploy without enrichment.

3. In GitHub → Settings → Environments → **`production`** (`--github` creates it), optionally add yourself as a
   required reviewer to approve each deploy. The variables below come from setup; add the secrets yourself
   with `gh secret set NAME --env production` or in the web UI:

   | Variable | Value |
   | --- | --- |
   | `AWS_REGION` | `region` from config.json |
   | `AWS_DEPLOY_ROLE_ARN` | output `DeployRoleArn` |
   | `SAM_ARTIFACTS_BUCKET` | output `ArtifactsBucketName` |
   | `SITE_BUCKET` | output `SiteBucketName` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | output `DistributionId` |
   | `SITE_URL` | output `SiteUrl` |
   | `API_STACK_NAME` | `apiStackName` from config.json |
   | `ANTHROPIC_AWS_WORKSPACE_ID` | `anthropicWorkspaceId` from config.json (optional; enables AI enrichment) |
   | `ALLOWED_ORIGINS` | optional, set by hand: comma-separated CORS origins (defaults to `SITE_URL`) |
   | `VITE_PUBLIC_PHONE`, `VITE_PUBLIC_EMAIL` | set by hand: contact details shown on the site |

   | Secret | Value |
   | --- | --- |
   | `DATABASE_URL` | production Postgres URL (used for migrations and by the Lambda) |
   | `ADMIN_EMAIL` | optional: the first dashboard admin, invited by email on the next deploy. A secret because this repo is public and variables appear in Actions logs. |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional |

4. Run **Backend**, then **Web**, once from the Actions tab ("Run workflow"). After that, merging to `main`
   deploys automatically. The web build reads the API URL and Cognito client ID from the API stack, so
   there's nothing to copy by hand.

**Notes**

- Migrations run from the GitHub runner, so the database must accept TLS connections from the internet
  (append `?sslmode=require` to `DATABASE_URL`). If the database is private to a VPC, run the backend
  deploy job on an [AWS CodeBuild-hosted runner](https://docs.aws.amazon.com/codebuild/latest/userguide/action-runner.html)
  inside that VPC instead of `ubuntu-latest`.
- Migrations apply before the new Lambda code ships. Keep them backward compatible: add a column in one
  release, and drop the old one in a later release.
- Old hashed JS/CSS files stay in the bucket after a deploy, so open tabs can still load their route chunks.
- If you rename the API stack or the repo, update `infra/config.json` and re-run setup with `--github`.

## Ad landing page, maps and tracking

**Landing page:** `/lawn-quote` is built for paid traffic: one goal, no site navigation, `noindex`. Link ads with
`?service=` (`lawn-care`, `artificial-turf`, `landscaping`) and `?city=` (Dallas, Fort Worth, Plano, Frisco, McKinney,
Allen, Prosper, Celina, Richardson, Garland) so the headline matches the ad, e.g.
`/lawn-quote?service=artificial-turf&city=fort-worth`. Lawn care and turf open the instant quote in place with that
service pre-selected; landscaping sends visitors to the project form with the city filled in. Variants and copy live
in `web/src/content/landing.ts`. A short "call me back" form further down the page serves visitors who won't use the
map.

Below the banner, the quote section works like the instant-quote page. Until an address is entered (in the banner,
which scrolls down to it, or in the section's own box), its map shows our own aerial image of the metro (USGS/USDA
NAIP, public domain), so page load makes no Amazon Location requests. The image is framed exactly like the live map's
opening view; once an address is entered, the live map loads behind it, cross-fades in and flies to the home, and the
quote continues in place. Landscaping pages show the consultation form there instead. Regenerate the image with
`cd web && node scripts/fetch-hero-backdrop.mjs` (keep its center and zoom in sync with `BACKDROP` in `landing.ts`, and
retune `BACKDROP.filter` if the live imagery's color changes).

**Maps:** address search and satellite imagery use Amazon Location Service (Places v2 and Maps v2). The API stack
creates a browser key (`MapsKey`) limited to tile and place reads from the site's origins and localhost; the Web
workflow reads its value at build time. Without a key (demo mode, `npm run dev` without `VITE_AWS_LOCATION_KEY`) the
map falls back to Esri imagery and OpenStreetMap search, which are fine for development only. On phones, the map
starts with a draggable outline instead of tap-to-draw; desktop is unchanged.

**Tracking:** each instant-quote step (`shared/funnel.ts`) is recorded anonymously via `POST /events` and charted on
the admin Analytics page. To also send events to ad platforms, set these GitHub variables in the `production`
environment (each script loads only when set): `VITE_GA4_ID`, `VITE_META_PIXEL_ID`, `VITE_GOOGLE_ADS_ID`,
`VITE_GOOGLE_ADS_CONVERSION_LABEL`. A submitted quote or project form counts as a Google Ads conversion and a Meta
`Lead`. Mention analytics and advertising cookies in the privacy policy before turning these on.

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
