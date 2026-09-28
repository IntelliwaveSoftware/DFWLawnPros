// Creates the test database if needed and applies migrations before the suite runs.
import { execFileSync } from 'node:child_process'
import pg from 'pg'

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://dfwlp:dfwlp_dev_only@localhost:55432/dfwlp_test')
  const dbName = url.pathname.slice(1)
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() })
  await admin.connect()
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`)
  await admin.end()
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  })
}
