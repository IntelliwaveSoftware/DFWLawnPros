// Local development server: serves the Lambda handler over HTTP the way API Gateway would.
//
//  * Routes come from the handler itself; which routes are public comes from template.yaml
//    (`Auth: Authorizer: NONE`), so auth rules match the deployed API.
//  * Auth: instead of verifying Cognito JWTs, protected routes accept LOCAL DEV TOKENS
//    (`local.<base64url JSON claims>`) issued by the web app's local sign-in mode. There is no
//    signature — never expose this server beyond localhost. It is not part of the Lambda bundle.
//
// Run: npm run dev   (http://localhost:8787)
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { handler, routes } from '../src/handler.js'

if (process.env.NODE_ENV === 'production') {
  console.error('dev-server refuses to run with NODE_ENV=production')
  process.exit(1)
}

const PORT = Number(process.env.PORT ?? 8787)
const HOST = '127.0.0.1'
const ALLOWED_ORIGINS = (process.env.DEV_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',')

// Public routes, read from the SAM template so local auth rules can't drift from AWS.
const template = readFileSync(new URL('../template.yaml', import.meta.url), 'utf8')
const PUBLIC_ROUTES = new Set(
  [...template.matchAll(/Method: (\w+)\n\s+Path: (\S+)\n\s+Auth:\n\s+Authorizer: NONE/g)].map(([, m, p]) => `${m} ${p}`),
)

// "GET /admin/leads/{id}" → matcher that also extracts path parameters.
const ROUTES = Object.keys(routes).map((routeKey) => {
  const [method, path] = routeKey.split(' ')
  const names: string[] = []
  const pattern = new RegExp(
    '^' +
      path.replace(/\{(\w+)\}/g, (_, name: string) => {
        names.push(name)
        return '([^/]+)'
      }) +
      '$',
  )
  return { routeKey, method, pattern, names }
})

function match(method: string, path: string) {
  for (const r of ROUTES) {
    if (r.method !== method) continue
    const m = r.pattern.exec(path)
    if (m) return { routeKey: r.routeKey, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) }
  }
  return null
}

function decodeLocalToken(header: string | undefined): Record<string, unknown> | null {
  const token = header?.match(/^Bearer local\.([A-Za-z0-9_-]+)$/)?.[1]
  if (!token) return null
  try {
    const claims = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    return claims && typeof claims.sub === 'string' ? claims : null
  } catch {
    return null
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function send(res: ServerResponse, status: number, headers: Record<string, string>, body: string) {
  res.writeHead(status, headers).end(body)
}

const server = createServer(async (req, res) => {
  const started = Date.now()
  const origin = req.headers.origin
  const cors: Record<string, string> =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'authorization, content-type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
          Vary: 'Origin',
        }
      : {}
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`)
  const method = req.method ?? 'GET'
  const log = (status: number) => console.log(`${method} ${url.pathname} → ${status} (${Date.now() - started}ms)`)

  if (method === 'OPTIONS') return send(res, 204, cors, '')

  const matched = match(method, url.pathname)
  if (!matched) {
    log(404)
    return send(res, 404, { ...cors, 'Content-Type': 'application/json' }, JSON.stringify({ message: 'Not Found' }))
  }

  // Mirror API Gateway's JWT authorizer: protected routes need a token; reject before the handler runs.
  const claims = decodeLocalToken(req.headers.authorization)
  if (!PUBLIC_ROUTES.has(matched.routeKey) && !claims) {
    log(401)
    return send(res, 401, { ...cors, 'Content-Type': 'application/json' }, JSON.stringify({ message: 'Unauthorized' }))
  }

  const event = {
    version: '2.0',
    routeKey: matched.routeKey,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '')])),
    queryStringParameters: url.search ? Object.fromEntries(url.searchParams) : undefined,
    pathParameters: Object.keys(matched.params).length ? matched.params : undefined,
    body: (await readBody(req)) || undefined,
    isBase64Encoded: false,
    requestContext: {
      http: { method, path: url.pathname, sourceIp: req.socket.remoteAddress ?? '127.0.0.1' },
      ...(claims && !PUBLIC_ROUTES.has(matched.routeKey) ? { authorizer: { jwt: { claims } } } : {}),
    },
  } as unknown as APIGatewayProxyEventV2

  try {
    const result = await handler(event)
    const status = result?.statusCode ?? 500
    log(status)
    const headers = Object.fromEntries(Object.entries(result?.headers ?? {}).map(([k, v]) => [k, String(v)]))
    send(res, status, { ...cors, ...headers }, result?.body ?? '')
  } catch (error) {
    console.error(error)
    log(500)
    send(res, 500, { ...cors, 'Content-Type': 'application/json' }, JSON.stringify({ message: 'Internal server error' }))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`DFW Lawn Pros API (local) → http://localhost:${PORT}`)
  console.log(`  ${ROUTES.length} routes · public: ${[...PUBLIC_ROUTES].join(', ')}`)
  console.log(`  auth: local dev tokens only · CORS: ${ALLOWED_ORIGINS.join(', ')}`)
  if (!process.env.ANTHROPIC_API_KEY) console.log('  ANTHROPIC_API_KEY not set: AI enrichment is skipped (leads are still scored)')
})
