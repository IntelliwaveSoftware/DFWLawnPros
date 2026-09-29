-- CreateTable
CREATE TABLE "funnel_events" (
    "id" BIGSERIAL NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "event" VARCHAR(40) NOT NULL,
    "page" VARCHAR(20) NOT NULL,
    "service" VARCHAR(40),
    "city" VARCHAR(60),
    "utm" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_events_created_at_idx" ON "funnel_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_events_session_id_event_key" ON "funnel_events"("session_id", "event");
