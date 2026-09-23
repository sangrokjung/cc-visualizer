import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const project = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
const bundle = path.join(project, 'src-tauri/resources/harness-scanner.cjs')
const home = os.homedir()
const paths = ['.claude/settings.json', '.claude/settings.local.json', '.claude.json', '.codex/config.toml', '.grok/config.toml', '.gemini/antigravity/mcp_config.json']
  .map(value => path.join(home, value)).filter(file => fs.existsSync(file))
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const before = paths.map(hash)
const help = execFileSync(process.execPath, [bundle, '--help'], { encoding: 'utf8' })
assert.match(help, /Usage:/)
const invalid = spawnSync(process.execPath, [bundle, '--project', 'relative'], { encoding: 'utf8' })
assert.equal(invalid.status, 1)
assert.match(invalid.stderr, /HARNESS_SCAN_FAILED/)
const output = execFileSync(process.execPath, [bundle, '--project', project], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000 })
const inventory = JSON.parse(output)
assert.deepEqual(paths.map(hash), before)
assert.equal(inventory.providers.length, 4)
assert.equal(inventory.scope, project)
assert.ok(inventory.resources.length)
const summary = {
  checkedAt: inventory.checkedAt,
  project: 'cc-visualizer',
  sourceConfigsUnchanged: true,
  sourceConfigCount: paths.length,
  helpExit: 0,
  invalidInputExit: invalid.status,
  inventoryBytes: Buffer.byteLength(output),
  uniqueResources: inventory.resources.length,
  bindings: inventory.bindings.length,
  providers: inventory.providers.map(provider => ({
    ...provider,
    resources: inventory.bindings.filter(binding => binding.providerId === provider.id).length,
    diagnostics: inventory.diagnostics.filter(diagnostic => diagnostic.providerId === provider.id)
      .reduce((counts, diagnostic) => ({ ...counts, [diagnostic.code]: (counts[diagnostic.code] ?? 0) + 1 }), {}),
  })),
}
console.log(JSON.stringify(summary, null, 2))
