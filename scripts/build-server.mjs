import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('apps/server/dist', { recursive: true })
await build({
  entryPoints: ['apps/server/index.ts'],
  outfile: 'apps/server/dist/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  logLevel: 'info'
})
