import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { InventorySchema, providerIds, type Inventory, type ProviderId, type Binding } from '../../src/renderer/src/features/harness/schema'
import { adapters } from './adapters'
import { Discovery } from './discovery'

export type ScanOptions = {
  home?: string
  project?: string
  pathEntries?: string[]
  applicationsDir?: string
  processExecutables?: string[] | null
  maxFiles?: number
}

export function readProcessExecutables(): string[] | null {
  try {
    const output = execFileSync('/bin/ps', ['-axo', 'pid=,comm='], { encoding: 'utf8', timeout: 3000, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    return output.split('\n').map(line => line.trim().replace(/^\d+\s+/, '')).filter(Boolean)
  } catch { return null }
}

function installed(id: ProviderId, pathEntries: string[], applications: string): Inventory['providers'][number]['installed'] {
  const names = id === 'antigravity' ? ['antigravity'] : [id]
  if (id === 'antigravity' && fs.existsSync(path.join(applications, 'Antigravity.app'))) return 'yes'
  let unknown = false
  for (const root of pathEntries) for (const name of names) {
    if (!path.isAbsolute(root)) continue
    try { fs.accessSync(path.join(root, name), fs.constants.X_OK); return 'yes' }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && (error.code === 'EACCES' || error.code === 'EPERM')) unknown = true }
  }
  return unknown ? 'unknown' : 'no'
}

function applyPrecedence(scan: Discovery): void {
  const groups = new Map<string, Binding[]>()
  for (const binding of scan.bindings) {
    const resource = scan.resources.get(binding.resourceId)
    if (!resource || !['skill', 'agent', 'mcp'].includes(resource.kind) || binding.scope === 'shared') continue
    if (binding.enabledState === 'disabled' && binding.reason.includes('compat.')) continue
    const key = `${resource.kind}:${resource.name}`
    const group = groups.get(key) ?? []
    group.push(binding); groups.set(key, group)
  }
  for (const group of groups.values()) {
    const maximum = Math.max(...group.map(binding => binding.precedence))
    const leaders = group.filter(binding => binding.precedence === maximum)
    for (const binding of group) {
      if (binding.enabledState === 'disabled') continue
      if (binding.precedence < maximum && !leaders.some(leader => leader.resourceId === binding.resourceId)) {
        binding.enabledState = 'shadowed'
        binding.evidence = 'configured'
        binding.reason = '같은 이름의 더 높은 파일 계층이 우선합니다. 실제 세션 적용은 관측하지 않았습니다.'
      } else if (new Set(leaders.map(leader => leader.resourceId)).size > 1 && binding.precedence === maximum) {
        binding.enabledState = 'unknown'
        binding.evidence = 'unresolved'
        binding.reason = '같은 우선순위에 같은 이름이 있습니다. 실제 선택은 미확정입니다.'
      }
    }
  }
}

export function scanHarness(options: ScanOptions = {}): Inventory {
  const home = path.resolve(options.home ?? os.homedir())
  if (options.project && !path.isAbsolute(options.project)) throw new Error('PROJECT_MUST_BE_ABSOLUTE')
  const project = options.project ? fs.realpathSync(options.project) : undefined
  if (project && !fs.statSync(project).isDirectory()) throw new Error('PROJECT_MUST_BE_DIRECTORY')
  const started = new Date().toISOString()
  const processes = options.processExecutables === undefined ? readProcessExecutables() : options.processExecutables
  const pathEntries = options.pathEntries ?? (process.env.PATH ?? '').split(path.delimiter)
  const applications = options.applicationsDir ?? '/Applications'
  const providers: Inventory['providers'] = []
  const resources: Inventory['resources'] = []
  const bindings: Inventory['bindings'] = []
  const diagnostics: Inventory['diagnostics'] = []
  for (const providerId of providerIds) {
    const clock = Date.now()
    const scan = new Discovery(providerId, started, options.maxFiles)
    let failed = false
    try { adapters[providerId](scan, { home, project }); applyPrecedence(scan) }
    catch { failed = true; scan.diagnostic(providerId, 'unsupported', '공급자 수집을 마치지 못했습니다. 이전 성공 데이터를 확인하세요.') }
    const sourceFailures = scan.diagnostics.some(item => ['permission-denied', 'limit'].includes(item.code) || item.code === 'malformed' && !/\.(?:md|mdc)$/i.test(item.source))
    const status = failed || sourceFailures ? 'error' : scan.diagnostics.length ? 'partial' : 'ok'
    const checkedAt = new Date().toISOString()
    const running = processes === null ? 'unknown' : processes.some(executable => path.basename(executable).toLowerCase() === providerId || providerId === 'antigravity' && executable.includes('/Antigravity.app/Contents/MacOS/')) ? 'observed' : 'not-observed'
    providers.push({ id: providerId, installed: installed(providerId, pathEntries, applications), configured: scan.configured,
      running, status, checkedAt, lastSuccessAt: status === 'error' ? null : checkedAt, durationMs: Date.now() - clock })
    resources.push(...scan.resources.values()); bindings.push(...scan.bindings); diagnostics.push(...scan.diagnostics)
  }
  const unique = Array.from(new Map(resources.map(resource => [resource.id, resource])).values())
  const relations: Inventory['relations'] = bindings.map(binding => ({
    from: binding.providerId, to: binding.resourceId, kind: 'configured-resource', provenance: 'configured', evidence: binding.reason,
  }))
  return InventorySchema.parse({ schemaVersion: 1, generation: randomUUID(), scope: project ?? 'global', scanStartedAt: started,
    checkedAt: new Date().toISOString(), mode: 'local', providers, resources: unique, bindings, relations, diagnostics })
}

export function writeInventory(file: string, inventory: Inventory): void {
  const output = path.resolve(file)
  if (fs.existsSync(output)) {
    const stats = fs.lstatSync(output)
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('OUTPUT_NOT_INVENTORY')
    try { InventorySchema.parse(JSON.parse(fs.readFileSync(output, 'utf8'))) }
    catch { throw new Error('OUTPUT_NOT_INVENTORY') }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temporary = `${output}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, JSON.stringify(inventory), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    fs.renameSync(temporary, output)
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
}
