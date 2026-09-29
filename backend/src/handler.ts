// Lambda entry point — a modular monolith behind one API Gateway HTTP API.
//
// Handles two kinds of events:
//   * API Gateway HTTP API (v2) requests → routed by `routeKey`
//   * { task: "enrich", lead_id } → async LLM enrichment, self-invoked after lead intake
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { db } from './db.js'
import { enrichLead } from './enrichment.js'
import { dispatch, json, type Result, type Routes } from './http.js'
import { paymentRoutes } from './payments.js'
import { adminRoutes } from './routes/admin.js'
import { contractorRoutes } from './routes/contractor.js'
import { eventRoutes } from './routes/events.js'
import { leadRoutes } from './routes/leads.js'

/**
 * Pinged by the site when a real visitor starts interacting, so the Lambda is warm and a paused Aurora
 * has resumed before they submit a form. The query is the point: it opens the pooled DB connection.
 */
const warmupRoutes: Routes = {
  async 'GET /warmup'() {
    await db().$queryRaw`SELECT 1`
    return json(204)
  },
}

export const routes: Routes = { ...leadRoutes, ...adminRoutes, ...contractorRoutes, ...paymentRoutes, ...warmupRoutes, ...eventRoutes }

type EnrichTask = { task: 'enrich'; lead_id: string }

export async function handler(event: APIGatewayProxyEventV2 | EnrichTask): Promise<Result | void> {
  if ('task' in event) {
    if (event.task === 'enrich') await enrichLead(event.lead_id)
    return
  }
  try {
    return await dispatch(routes, event)
  } catch (error) {
    console.error(`unhandled error on ${event.routeKey}`, error)
    return json(500, { message: 'Internal server error' })
  }
}
