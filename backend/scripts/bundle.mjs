// Bundles the Lambda into a single ESM file (dist/index.mjs) for the nodejs24.x runtime.
// Everything is bundled — including the Prisma client and its WASM query compiler — except
// the AWS SDK, which the Lambda runtime provides.
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/handler.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  sourcemap: true,
  external: ['@aws-sdk/*'],
  // Some bundled CommonJS dependencies call require(); give ESM output a real one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  metafile: true,
  logLevel: 'warning',
})

const bytes = Object.values(result.metafile.outputs).find((o) => o.entryPoint)?.bytes ?? 0
console.log(`dist/index.mjs  ${(bytes / 1024).toFixed(0)} KiB`)
