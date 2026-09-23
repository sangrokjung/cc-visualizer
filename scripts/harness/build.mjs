import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
  entryPoints: [fileURLToPath(new URL('./cli.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../../src-tauri/resources/harness-scanner.cjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: false,
  legalComments: 'none',
})
