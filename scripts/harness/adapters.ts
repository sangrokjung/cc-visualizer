import path from 'node:path'
import fs from 'node:fs'
import { Discovery, object, strings, type Document, type SourceOptions } from './discovery'
import type { ProviderId } from '../../src/renderer/src/features/harness/schema'

export type ScanPaths = { home: string; project?: string }
const globalSource: SourceOptions = { scope: 'global', precedence: 10 }
const projectSource: SourceOptions = { scope: 'project', precedence: 100 }
const unresolved = '파일 구성만 관측했습니다. 프로젝트 신뢰·세션 override의 실제 적용은 미확정입니다.'
const scopes = (paths: ScanPaths): Array<{ base: string; options: SourceOptions }> => [
  { base: paths.home, options: globalSource },
  ...(paths.project ? [{ base: paths.project, options: projectSource }] : []),
]

function jsonSources(scan: Discovery, files: string[], options: SourceOptions, includeMcp = true, deferDisableAllHooks = false): Document {
  let settings: Document = {}
  for (const file of files) {
    const config = scan.config(file)
    if (!config) continue
    settings = { ...settings, ...config }
    scan.hooks(file, deferDisableAllHooks ? { ...config, disableAllHooks: false } : config, options)
    if (includeMcp) scan.mcp(file, config, options, strings(config.disabledMcpServers))
  }
  return settings
}

function claude(scan: Discovery, paths: ScanPaths): void {
  let globalSettings: Document = {}
  let effectiveSettings: Document = {}
  for (const { base, options } of scopes(paths)) {
    const root = path.join(base, '.claude')
    scan.directory(path.join(root, 'agents'), 'agent', options)
    scan.directory(path.join(root, 'skills'), 'skill', options, 'skills')
    scan.directory(path.join(root, 'commands'), 'skill', options)
    scan.directory(path.join(root, 'rules'), 'rule', options)
    scan.markdown(path.join(root, 'CLAUDE.md'), 'rule', options, true)
    if (options.scope === 'project') scan.markdown(path.join(base, 'CLAUDE.md'), 'rule', options, true)
    const settings = jsonSources(scan, [path.join(root, 'settings.json'), path.join(root, 'settings.local.json')], options, true, true)
    if (options.scope === 'global') globalSettings = settings
    effectiveSettings = { ...effectiveSettings, ...settings }
    if (options.scope === 'project') jsonSources(scan, [path.join(base, '.mcp.json')], { ...options, state: 'unknown', reason: '프로젝트 MCP 설정을 발견했습니다. 승인·연결 상태는 미확정입니다.' })
  }
  if (effectiveSettings.disableAllHooks === true) {
    for (const binding of scan.bindings) {
      if (scan.resources.get(binding.resourceId)?.kind === 'hook') {
        binding.enabledState = 'disabled'
        binding.reason = '전역·프로젝트 설정을 합친 disableAllHooks 값이 true여서 모든 훅이 비활성화되어 있습니다.'
      }
    }
  }
  const claudeJson = path.join(paths.home, '.claude.json')
  const config = scan.config(claudeJson)
  if (config) {
    scan.mcp(claudeJson, config, globalSource, strings(globalSettings.disabledMcpServers))
    if (paths.project) {
      const project = object(object(config.projects)[paths.project])
      scan.mcp(claudeJson, project, { ...projectSource, state: 'unknown', reason: unresolved }, strings(project.disabledMcpServers), paths.project)
    }
  }
  const installed = path.join(paths.home, '.claude/plugins/installed_plugins.json')
  const plugins = scan.config(installed)
  if (plugins) scan.plugins(installed, plugins, globalSource, object(globalSettings.enabledPlugins))
}

function codex(scan: Discovery, paths: ScanPaths): void {
  for (const { base, options } of scopes(paths)) {
    const root = path.join(base, '.codex')
    const source = { ...options, state: 'unknown' as const, reason: unresolved }
    scan.directory(path.join(root, 'agents'), 'agent', source)
    scan.directory(path.join(root, 'skills'), 'skill', source, 'skills')
    scan.directory(path.join(base, '.agents/skills'), 'skill', { ...source, precedence: options.precedence + 5 }, 'skills')
    const instructionRoot = options.scope === 'global' ? root : base
    scan.markdown(path.join(instructionRoot, 'AGENTS.md'), 'rule', source, true)
    scan.markdown(path.join(instructionRoot, 'AGENTS.override.md'), 'rule', { ...source, precedence: options.precedence + 1 }, true)
    const override = scan.bindings.find(binding => binding.scope === options.scope && scan.resources.get(binding.resourceId)?.sourceRef === path.join(instructionRoot, 'AGENTS.override.md'))
    if (override) {
      for (const binding of scan.bindings) if (binding.scope === options.scope && scan.resources.get(binding.resourceId)?.sourceRef === path.join(instructionRoot, 'AGENTS.md')) {
        binding.enabledState = 'shadowed'; binding.reason = '같은 범위의 AGENTS.override.md가 우선합니다.'
      }
    }
    const file = path.join(root, 'config.toml')
    const config = scan.config(file)
    if (!config) continue
    scan.mcp(file, config, source)
    const skillConfig = object(config.skills).config
    if (Array.isArray(skillConfig)) for (const entry of skillConfig) {
      const value = object(entry)
      if (typeof value.path !== 'string' || value.enabled !== false) continue
      const configuredPath = expandPath(value.path, paths.home, base)
      let canonical: string
      try { canonical = fs.realpathSync(configuredPath) } catch { continue }
      for (const binding of scan.bindings) {
        const resource = scan.resources.get(binding.resourceId)
        if (resource?.kind === 'skill' && (resource.canonicalIdentity.startsWith(canonical + '#') || resource.canonicalIdentity.startsWith(canonical + path.sep))) {
          binding.enabledState = 'disabled'; binding.reason = 'Codex skills.config에서 비활성으로 지정했습니다.'
        }
      }
    }
    const agents = object(config.agents)
    for (const [name, raw] of Object.entries(agents)) {
      const agent = object(raw)
      if (!Object.keys(agent).length) continue
      if (typeof agent.config_file === 'string') {
        const agentFile = expandPath(agent.config_file, paths.home, path.dirname(file))
        if (agentFile.startsWith(root + path.sep)) {
          const agentConfig = scan.config(agentFile)
          if (agentConfig) scan.add(agentFile, fs.realpathSync(agentFile), 'agent', name, typeof agent.description === 'string' ? agent.description : '', source)
        } else scan.diagnostic(file, 'unsupported', '표준 agents 경계 밖 config_file은 수집하지 않습니다.')
      }
    }
    if (Object.keys(object(config.plugins)).length) scan.plugins(file, config, source)
  }
  const file = path.join(paths.home, '.codex/plugins/installed_plugins.json')
  const plugins = scan.config(file)
  if (plugins) scan.plugins(file, plugins, { ...globalSource, state: 'unknown', reason: unresolved })
  cachedCodexManifests(scan, path.join(paths.home, '.codex/plugins/cache'))
}

function cachedCodexManifests(scan: Discovery, root: string): void {
  if (!scan.exists(root)) return
  const canonicalRoot = scan.registerRoot(root)
  if (!canonicalRoot) return
  let count = 0
  const walk = (directory: string, depth: number): void => {
    if (depth > 3 || count >= 300) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(directory, { withFileTypes: true }) }
    catch { scan.diagnostic(directory, 'permission-denied', '플러그인 캐시 폴더를 읽지 못했습니다.'); return }
    if (depth === 3) {
      const file = path.join(directory, '.codex-plugin/plugin.json')
      if (!scan.exists(file)) return
      const canonical = fs.realpathSync(file)
      if (!canonical.startsWith(canonicalRoot + path.sep)) { scan.diagnostic(file, 'unsupported', '플러그인 캐시 경계를 벗어난 링크는 수집하지 않습니다.'); return }
      const manifest = scan.config(file)
      if (manifest) {
        count++
        scan.add(file, canonical, 'plugin', typeof manifest.name === 'string' ? manifest.name : path.basename(path.dirname(directory)), '플러그인 캐시의 manifest입니다. 현재 버전 선택·세션 활성은 미확정입니다.', {
          ...globalSource, state: 'unknown', origin: 'codex-plugin-cache', reason: '캐시에 존재하는 버전입니다. 설치 선택과 세션 활성 여부는 관측하지 않았습니다.',
        })
      }
      return
    }
    for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith('.')) walk(path.join(directory, entry.name), depth + 1)
  }
  walk(root, 0)
  if (count >= 300) scan.diagnostic(root, 'limit', '플러그인 manifest 수집 상한에 도달했습니다.')
}

function expandPath(value: string, home: string, base: string): string {
  return value.startsWith('~/') ? path.join(home, value.slice(2)) : path.resolve(base, value)
}

function grok(scan: Discovery, paths: ScanPaths): void {
  const configFile = path.join(paths.home, '.grok/config.toml')
  const config = scan.config(configFile) ?? {}
  const compat = object(config.compat)
  const skillSettings = object(config.skills)
  const disabledSkills = new Set(strings(skillSettings.disabled))
  const ignored = strings(skillSettings.ignore).map(value => expandPath(value, paths.home, paths.home))
  const disabledMcp = strings(config.disabled_mcp_servers)
  const compatOptions = (vendor: string, field: string, options: SourceOptions): SourceOptions => ({
    ...options, precedence: options.precedence - 5,
    state: object(compat[vendor])[field] === false ? 'disabled' : 'unknown',
    origin: vendor, reason: object(compat[vendor])[field] === false ? `Grok compat.${vendor}.${field}가 비활성입니다.` : unresolved,
  })
  for (const { base, options } of scopes(paths)) {
    const root = path.join(base, '.grok')
    const source: SourceOptions = { ...options, state: 'unknown', reason: unresolved }
    const skills: SourceOptions = { ...source, disabled: disabledSkills, ignored }
    scan.directory(path.join(root, 'skills'), 'skill', skills, 'skills')
    scan.directory(path.join(root, 'commands'), 'skill', skills)
    scan.directory(path.join(base, '.agents/skills'), 'skill', skills, 'skills')
    scan.directory(path.join(base, '.agents/commands'), 'skill', skills)
    scan.directory(path.join(root, 'agents'), 'agent', source)
    scan.directory(path.join(root, 'rules'), 'rule', source)
    scan.directory(path.join(root, 'workflows'), 'workflow', source)
    scan.directory(path.join(root, 'hooks'), 'hook', source, 'config-hooks')
    scan.markdown(path.join(base, 'AGENTS.md'), 'rule', source, true)
    scan.markdown(path.join(root, 'GROK.md'), 'rule', source, true)
    for (const vendor of ['claude', 'cursor', 'codex']) {
      const vendorRoot = path.join(base, '.' + vendor)
      const skillSource = { ...compatOptions(vendor, 'skills', options), disabled: disabledSkills, ignored }
      scan.directory(path.join(vendorRoot, 'skills'), 'skill', skillSource, 'skills')
      if (vendor !== 'codex') scan.directory(path.join(vendorRoot, 'commands'), 'skill', skillSource)
      if (vendor === 'claude') {
        scan.markdown(path.join(base, options.scope === 'global' ? '.claude/CLAUDE.md' : 'CLAUDE.md'), 'rule', compatOptions(vendor, 'agents', options), true)
        scan.directory(path.join(vendorRoot, 'rules'), 'rule', compatOptions(vendor, 'rules', options))
        const hookOptions = compatOptions(vendor, 'hooks', options)
        jsonSources(scan, [path.join(vendorRoot, 'settings.json'), path.join(vendorRoot, 'settings.local.json')], hookOptions, false)
      } else if (vendor === 'cursor') {
        scan.directory(path.join(vendorRoot, 'rules'), 'rule', compatOptions(vendor, 'rules', options))
        jsonSources(scan, [path.join(vendorRoot, 'hooks.json')], compatOptions(vendor, 'hooks', options), false)
        const file = path.join(vendorRoot, 'mcp.json')
        const cursor = scan.config(file)
        if (cursor) scan.mcp(file, cursor, { ...compatOptions(vendor, 'mcps', options), precedence: options.precedence + 200 }, disabledMcp)
      }
    }
    const file = path.join(root, 'config.toml')
    const layer = options.scope === 'global' ? config : scan.config(file)
    if (layer && scan.exists(file)) {
      scan.mcp(file, layer, { ...source, precedence: options.precedence + 400 }, disabledMcp)
      if (options.scope === 'global') scan.hooks(file, layer, source)
      if (Object.keys(object(layer.plugins)).length) scan.plugins(file, layer, source)
    }
    if (options.scope === 'project') {
      const mcpFile = path.join(base, '.mcp.json')
      const mcp = scan.config(mcpFile)
      if (mcp) scan.mcp(mcpFile, mcp, { ...source, precedence: 1 }, disabledMcp)
    }
  }
  const claudeFile = path.join(paths.home, '.claude.json')
  const claude = scan.config(claudeFile)
  if (claude) scan.mcp(claudeFile, claude, { ...compatOptions('claude', 'mcps', globalSource), precedence: 350 }, disabledMcp)
  for (const extra of strings(skillSettings.paths)) {
    const root = expandPath(extra, paths.home, paths.home)
    const options: SourceOptions = { ...globalSource, state: 'unknown', reason: unresolved, disabled: disabledSkills, ignored }
    if (path.basename(root) === 'SKILL.md') scan.markdown(root, 'skill', options, true)
    else scan.directory(root, 'skill', options, 'skills')
  }
  const manifest = path.join(paths.home, '.grok/bundled/manifest.json')
  const bundled = scan.config(manifest)
  if (bundled) {
    scan.add(manifest, fs.realpathSync(manifest), 'plugin', 'Grok bundled resources', '번들 manifest를 발견했습니다. 개별 세션 활성 상태는 미확정입니다.', { ...globalSource, state: 'unknown', precedence: 0 })
    for (const kind of ['agents', 'skills', 'workflows'] as const) scan.directory(path.join(paths.home, '.grok/bundled', kind), kind === 'agents' ? 'agent' : kind === 'skills' ? 'skill' : 'workflow', { ...globalSource, state: 'unknown', precedence: 0 }, kind === 'skills' ? 'skills' : 'markdown')
  }
  const subagents = object(config.subagents)
  const toggles = object(subagents.toggle)
  for (const binding of scan.bindings) {
    const resource = scan.resources.get(binding.resourceId)
    if (resource?.kind === 'agent' && (subagents.enabled === false || toggles[resource.name] === false)) {
      binding.enabledState = 'disabled'; binding.reason = 'Grok subagents 설정에서 비활성으로 지정했습니다.'
    }
  }
  for (const layer of ['managed_config.toml', 'requirements.toml']) if (scan.exists(path.join(paths.home, '.grok', layer))) {
    scan.diagnostic(path.join(paths.home, '.grok', layer), 'unsupported', '관리 계층이 존재합니다. 이 계층과 세션 환경의 유효 설정은 미확정입니다.')
  }
}

function antigravity(scan: Discovery, paths: ScanPaths): void {
  const source: SourceOptions = { ...globalSource, state: 'unknown', reason: '파일 구성은 관측했으나 Antigravity 세션의 적용은 미확정입니다.' }
  const root = path.join(paths.home, '.gemini/antigravity')
  scan.directory(path.join(root, 'skills'), 'skill', source, 'skills')
  scan.directory(path.join(root, 'global_workflows'), 'workflow', source)
  scan.directory(path.join(root, 'workflows'), 'workflow', source)
  const file = path.join(root, 'mcp_config.json')
  const config = scan.config(file)
  if (config) scan.mcp(file, config, source)
  const shared: SourceOptions = { ...source, scope: 'shared', origin: 'gemini', reason: 'Gemini 공유 후보입니다. Antigravity의 실제 적용은 확인하지 않았습니다.' }
  scan.directory(path.join(paths.home, '.gemini/skills'), 'skill', shared, 'skills')
  scan.markdown(path.join(paths.home, '.gemini/GEMINI.md'), 'rule', shared, true)
  if (paths.project) {
    const project: SourceOptions = { ...projectSource, state: 'unknown', reason: source.reason }
    scan.directory(path.join(paths.project, '.agent/skills'), 'skill', project, 'skills')
    scan.directory(path.join(paths.project, '.agent/rules'), 'rule', project)
    scan.directory(path.join(paths.project, '.agent/workflows'), 'workflow', project)
    scan.markdown(path.join(paths.project, 'GEMINI.md'), 'rule', { ...project, reason: shared.reason }, true)
  }
  if (scan.exists(path.join(root, 'user_settings.pb'))) scan.diagnostic(path.join(root, 'user_settings.pb'), 'unsupported', '불투명 설정 파일은 해독하지 않습니다. 적용 상태는 미확정입니다.')
}

export const adapters: Record<ProviderId, (scan: Discovery, paths: ScanPaths) => void> = { claude, codex, grok, antigravity }
