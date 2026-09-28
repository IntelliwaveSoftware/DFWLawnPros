import { defineConfig } from 'prisma/config'

// Prisma 7 no longer loads .env automatically.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env file (CI, production). Rely on the real environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` does not need a database, so a missing URL is allowed here.
    url: process.env.DATABASE_URL ?? '',
  },
})
