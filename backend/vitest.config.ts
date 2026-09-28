import { defineConfig } from 'vitest/config'

try {
  process.loadEnvFile('.env')
} catch {
  // CI provides TEST_DATABASE_URL directly.
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://dfwlp:dfwlp_dev_only@localhost:55432/dfwlp_test'

export default defineConfig({
  test: {
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one database.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      DATABASE_SSL: 'false',
    },
  },
})
