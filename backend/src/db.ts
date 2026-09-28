// Prisma client for Lambda. Created once per container and reused across warm invocations.
// Each Lambda instance handles one request at a time, so a tiny pool is enough; put RDS Proxy
// in front of Aurora once concurrency grows.
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from './generated/prisma/client.js'

export { Prisma }

let client: PrismaClient | undefined

/** TLS is required for remote databases (Aurora); local Postgres runs without it. */
function useTls(connectionString: string): boolean {
  if (process.env.DATABASE_SSL) return process.env.DATABASE_SSL !== 'false'
  const host = URL.canParse(connectionString) ? new URL(connectionString).hostname : ''
  return !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
}

export function db(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? ''
  client ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 2),
      ssl: useTls(connectionString) ? { rejectUnauthorized: true } : undefined,
    }),
  })
  return client
}

export async function disconnect(): Promise<void> {
  await client?.$disconnect()
  client = undefined
}

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

/** Append a lifecycle event. Duplicate "presented" events are ignored by a partial unique index. */
export async function addEvent(
  lead_id: string,
  type: string,
  contractor_id: string | null = null,
  payload: Prisma.InputJsonValue | null = null,
  tx: Prisma.TransactionClient = db(),
): Promise<void> {
  await tx.leadEvent.createMany({
    data: [{ lead_id, contractor_id, type, payload: payload ?? Prisma.DbNull }],
    skipDuplicates: true,
  })
}
