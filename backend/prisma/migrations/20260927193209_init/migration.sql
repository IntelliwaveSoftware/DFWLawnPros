-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('new', 'available', 'purchased', 'closed', 'rejected');

-- CreateEnum
CREATE TYPE "lead_source" AS ENUM ('lead_form', 'instant_quote');

-- CreateEnum
CREATE TYPE "purchase_status" AS ENUM ('pending_payment', 'completed', 'refunded', 'cancelled');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "address" VARCHAR(300),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(2) NOT NULL DEFAULT 'TX',
    "zip_code" VARCHAR(10) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "service" VARCHAR(40) NOT NULL,
    "budget" VARCHAR(40) NOT NULL,
    "timeframe" VARCHAR(40) NOT NULL,
    "project_description" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "quote" JSONB,
    "source" "lead_source" NOT NULL,
    "utm" JSONB,
    "consent_timestamp" TIMESTAMPTZ(3) NOT NULL,
    "consent_text" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "status" "lead_status" NOT NULL DEFAULT 'new',
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "score" SMALLINT,
    "score_breakdown" JSONB,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_enrichments" (
    "lead_id" UUID NOT NULL,
    "extracted_services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "project_type" TEXT,
    "estimated_project_size" VARCHAR(10),
    "estimated_budget" DECIMAL(12,2),
    "urgency" VARCHAR(10),
    "intent" VARCHAR(10),
    "ai_summary" TEXT,
    "model" TEXT NOT NULL,
    "raw_output" JSONB,
    "enrichment_timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_enrichments_pkey" PRIMARY KEY ("lead_id")
);

-- CreateTable
CREATE TABLE "contractors" (
    "id" UUID NOT NULL,
    "cognito_sub" TEXT NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "service_area" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_purchases" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "contractor_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "purchased_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "purchase_status" NOT NULL DEFAULT 'completed',
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,

    CONSTRAINT "lead_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_outcomes" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "contractor_id" UUID NOT NULL,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "appointment_booked" BOOLEAN NOT NULL DEFAULT false,
    "quote_given" BOOLEAN NOT NULL DEFAULT false,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "lost" BOOLEAN NOT NULL DEFAULT false,
    "estimated_job_value" DECIMAL(12,2),
    "notes" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_events" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" UUID NOT NULL,
    "contractor_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_configs" (
    "version" SERIAL NOT NULL,
    "rules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at" DESC);

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_service_zip_code_idx" ON "leads"("service", "zip_code");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contractors_cognito_sub_key" ON "contractors"("cognito_sub");

-- CreateIndex
CREATE INDEX "contractors_service_area_idx" ON "contractors" USING GIN ("service_area");

-- CreateIndex
CREATE INDEX "contractors_services_idx" ON "contractors" USING GIN ("services");

-- CreateIndex
CREATE UNIQUE INDEX "lead_purchases_stripe_checkout_session_id_key" ON "lead_purchases"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "lead_purchases_contractor_id_purchased_at_idx" ON "lead_purchases"("contractor_id", "purchased_at" DESC);

-- CreateIndex
CREATE INDEX "lead_purchases_lead_id_idx" ON "lead_purchases"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_outcomes_lead_id_contractor_id_key" ON "lead_outcomes"("lead_id", "contractor_id");

-- CreateIndex
CREATE INDEX "lead_events_lead_id_created_at_idx" ON "lead_events"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_events_type_created_at_idx" ON "lead_events"("type", "created_at");

-- AddForeignKey
ALTER TABLE "lead_enrichments" ADD CONSTRAINT "lead_enrichments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_purchases" ADD CONSTRAINT "lead_purchases_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_purchases" ADD CONSTRAINT "lead_purchases_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_outcomes" ADD CONSTRAINT "lead_outcomes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_outcomes" ADD CONSTRAINT "lead_outcomes_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: constraints Prisma's schema language can't express.
-- ---------------------------------------------------------------------------

-- Exclusive-lead model: at most one live (pending or completed) purchase per lead.
-- Drop this index to move to a shared-lead model.
CREATE UNIQUE INDEX "lead_purchases_exclusive_idx"
  ON "lead_purchases" ("lead_id") WHERE "status" IN ('pending_payment', 'completed');

-- One "presented" event per lead/contractor pair.
CREATE UNIQUE INDEX "lead_events_presented_once_idx"
  ON "lead_events" ("lead_id", "contractor_id") WHERE "type" = 'presented';

ALTER TABLE "leads" ADD CONSTRAINT "leads_score_range" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "lead_outcomes" ADD CONSTRAINT "lead_outcomes_not_won_and_lost" CHECK (NOT ("won" AND "lost"));
ALTER TABLE "lead_enrichments"
  ADD CONSTRAINT "lead_enrichments_size" CHECK ("estimated_project_size" IN ('small', 'medium', 'large')),
  ADD CONSTRAINT "lead_enrichments_urgency" CHECK ("urgency" IN ('low', 'medium', 'high')),
  ADD CONSTRAINT "lead_enrichments_intent" CHECK ("intent" IN ('low', 'medium', 'high'));

-- Exactly one active scoring config.
CREATE UNIQUE INDEX "scoring_configs_one_active_idx" ON "scoring_configs" ("active") WHERE "active";
