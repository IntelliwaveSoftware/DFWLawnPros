// Lambda entry point — a modular monolith behind one API Gateway HTTP API.
//
// Handles two kinds of events:
//   * API Gateway HTTP API (v2) requests → routed by `routeKey`
//   * { task: "enrich", lead_id } → async LLM enrichment, self-invoked after lead intake
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { enrichLead } from './enrichment.js'
import { dispatch, json, type Result, type Routes } from './http.js'
import { paymentRoutes } from './payments.js'
import { adminRoutes } from './routes/admin.js'
import { contractorRoutes } from './routes/contractor.js'
import { leadRoutes } from './routes/leads.js'

export const routes: Routes = { ...leadRoutes, ...adminRoutes, ...contractorRoutes, ...paymentRoutes }

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
