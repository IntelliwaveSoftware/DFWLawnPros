// Request/response helpers for API Gateway HTTP API (payload format 2.0).
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { Prisma } from './db.js'

/** The structured response form of APIGatewayProxyResultV2 (the only one this API returns). */
export interface Result {
  statusCode: number
  headers?: Record<string, string>
  body: string
}

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Serialize Prisma values the web app expects as plain JSON: Decimal → number, BigInt → string.
 * Decimal defines its own toJSON (→ string) that runs before any replacer, so convert up front.
 */
function toPlain(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber()
  if (Array.isArray(value)) return value.map(toPlain)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]))
  }
  return value
}

export function json(status: number, body?: unknown): Result {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(toPlain(body)),
  }
}

export interface User {
  sub: string
  email: string
  name: string
  groups: string[]
}

export interface Request {
  method: string
  path: string
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  rawBody: string
  user: User | null
  sourceIp: string | null
}

export function body(req: Request): Record<string, unknown> {
  let data: unknown
  try {
    data = JSON.parse(req.rawBody || '{}')
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Expected a JSON object')
  return data as Record<string, unknown>
}

export function requireUser(req: Request): User {
  if (!req.user) throw new HttpError(401, 'Not signed in')
  return req.user
}

export function requireAdmin(req: Request): User {
  const user = requireUser(req)
  if (!user.groups.includes('admin')) throw new HttpError(403, 'Admin access required')
  return user
}

// HTTP API JWT authorizers pass array claims as a string like "[admin contractor]".
function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') return raw.split(/[\s,[\]]+/).filter(Boolean)
  return []
}

type AuthorizedEvent = APIGatewayProxyEventV2 & {
  requestContext: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } }
}

export function parseEvent(event: AuthorizedEvent): Request {
  const claims = event.requestContext.authorizer?.jwt?.claims
  const rawBody = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    : ''
  return {
    method: event.requestContext.http?.method ?? 'GET',
    path: event.rawPath ?? '/',
    params: (event.pathParameters ?? {}) as Record<string, string>,
    query: (event.queryStringParameters ?? {}) as Record<string, string>,
    headers: Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v ?? ''])),
    rawBody,
    user: claims
      ? {
          sub: String(claims.sub),
          email: String(claims.email ?? ''),
          name: String(claims.name ?? claims.email ?? ''),
          groups: parseGroups(claims['cognito:groups']),
        }
      : null,
    sourceIp: event.requestContext.http?.sourceIp ?? null,
  }
}

export type Handler = (req: Request) => Promise<unknown>
export type Routes = Record<string, Handler>

/** Route key format matches API Gateway: "GET /admin/leads/{id}". */
export async function dispatch(routes: Routes, event: AuthorizedEvent): Promise<Result> {
  const handler = routes[event.routeKey]
  if (!handler) return json(404, { message: 'Not found' })
  try {
    const result = await handler(parseEvent(event))
    if (result && typeof result === 'object' && 'statusCode' in result) return result as Result
    return json(200, result ?? null)
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { message: error.message })
    throw error
  }
}

// Small validation helpers for request bodies.
export function str(data: Record<string, unknown>, key: string, maxLen = 200, required = true): string {
  const value = data[key]
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    if (required) throw new HttpError(400, `${key} is required`)
    return ''
  }
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be a string`)
  const trimmed = value.trim()
  if (trimmed.length > maxLen) throw new HttpError(400, `${key} is too long`)
  return trimmed
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/** Path ids must be UUIDs; anything else is a 404 rather than a database error. */
export function idParam(req: Request, name = 'id'): string {
  const id = req.params[name] ?? ''
  if (!isUuid(id)) throw new HttpError(404, 'Not found')
  return id
}
