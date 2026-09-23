import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import matter from 'gray-matter'
import { parse as parseToml } from 'smol-toml'
import type { Binding, HarnessResource, Inventory, ProviderId, ResourceKind } from '../../src/renderer/src/features/harness/schema'

export type Document = Record<string, unknown>
export type SourceOptions = {
  scope: Binding['scope']
  precedence: number
  state?: Binding['enabledState']
  reason?: string
  origin?: string
  disabled?: Set<string>
  ignored?: string[]
}
export const object = (value: unknown): Document => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Document : {}
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
export const stableId = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 24)
const within = (file: string, root: string): boolean => file === root || file.startsWith(root + path.sep)

export function metadataText(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/https?:\/\/\S+/gi, '[주소 생략]')
    .replace(/(?:sk-|ghp_|github_pat_|xai-)[A-Za-z0-9_-]{12,}/g, '[인증 정보 생략]')
    .replace(/(?:bearer|api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, '[인증 정보 생략]')
    .trim().slice(0, limit)
}

export class Discovery {
  resources = new Map<string, HarnessResource>()
  bindings: Binding[] = []
  diagnostics: Inventory['diagnostics'] = []
  configured = false
  private roots = new Set<string>()
  private files = 0
  private exhausted = false

  constructor(readonly providerId: ProviderId, readonly observedAt: string, readonly maxFiles = 6000) {}

  diagnostic(source: string, code: Inventory['diagnostics'][number]['code'], message: string): void {
    if (!this.diagnostics.some(item => item.source === source && item.code === code)) {
      this.diagnostics.push({ providerId: this.providerId, source, code, message })
    }
  }

  private error(file: string, error: unknown): void {
    const code = object(error).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return
    this.diagnostic(file, code === 'EACCES' || code === 'EPERM' ? 'permission-denied' : 'unsupported',
      code === 'EACCES' || code === 'EPERM' ? '읽기 권한이 없어 관측하지 못했습니다.' : '파일 또는 링크를 안전하게 읽지 못했습니다.')
  }

  exists(file: string): boolean {
    try { fs.statSync(file); return true } catch (error) { this.error(file, error); return false }
  }

  /** 표준 루트의 직접 링크는 설치 경로로 인정하고, 그 아래 링크는 경계를 다시 검사한다. */
  registerRoot(root: string): string | null {
    try {
      const canonical = fs.realpathSync(root)
      if (canonical !== path.resolve(root) && within(path.resolve(root), canonical)) {
        this.diagnostic(root, 'unsupported', '리소스 루트가 상위 폴더 전체를 가리켜 수집하지 않습니다.')
        return null
      }
      this.roots.add(canonical)
      return canonical
    } catch (error) { this.error(root, error); return null }
  }

  private canonical(file: string, trustedFile = false): string | null {
    try {
      const canonical = fs.realpathSync(file)
      if (!trustedFile && !Array.from(this.roots).some(root => within(canonical, root))) {
        this.diagnostic(file, 'unsupported', '등록된 리소스 경계를 벗어난 링크는 수집하지 않습니다.')
        return null
      }
      return canonical
    } catch (error) {
      if (object(error).code === 'ENOENT') this.diagnostic(file, 'missing', '링크의 원본 파일이 없습니다.')
      else this.error(file, error)
      return null
    }
  }

  read(file: string, trustedFile = false): { content: string; canonical: string } | null {
    if (this.files >= this.maxFiles) {
      if (!this.exhausted) this.diagnostic(file, 'limit', '수집 파일 수 상한에 도달했습니다.')
      this.exhausted = true
      return null
    }
    const canonical = this.canonical(file, trustedFile)
    if (!canonical) return null
    try {
      const stats = fs.statSync(canonical)
      if (!stats.isFile()) return null
      if (stats.size > 2 * 1024 * 1024) {
        this.diagnostic(file, 'limit', '2MB를 넘는 파일은 수집하지 않습니다.')
        return null
      }
      this.files++
      return { content: fs.readFileSync(canonical, 'utf8'), canonical }
    } catch (error) { this.error(file, error); return null }
  }

  config(file: string): Document | null {
    if (!this.exists(file)) return null
    this.configured = true
    const source = this.read(file, true)
    if (!source) return null
    try {
      const parsed: unknown = file.endsWith('.toml') ? parseToml(source.content) : JSON.parse(source.content)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required')
      return object(parsed)
    } catch {
      this.diagnostic(file, 'malformed', '설정 형식을 읽지 못했습니다. 원문은 표시하지 않습니다.')
      return null
    }
  }

  add(file: string, canonical: string, kind: ResourceKind, name: string, description: string, options: SourceOptions, fragment = ''): void {
    const canonicalIdentity = `${canonical}#${kind}${fragment ? ':' + stableId(fragment) : ''}`
    const id = stableId(canonicalIdentity)
    const cleanName = metadataText(name, 200) || kind
    if (options.ignored?.some(root => within(path.resolve(file), root) || within(canonical, root))) return
    this.configured = true
    if (!this.resources.has(id)) this.resources.set(id, {
      id, kind, name: cleanName, description: metadataText(description, 400), sourceRef: file,
      canonicalIdentity, origin: options.origin ?? this.providerId,
    })
    const disabled = options.disabled?.has(cleanName)
    const state = disabled ? 'disabled' : options.state ?? 'enabled'
    const binding: Binding = {
      providerId: this.providerId, resourceId: id, scope: options.scope, enabledState: state,
      precedence: options.precedence, evidence: state === 'unknown' ? 'unresolved' : 'configured',
      observedAt: this.observedAt, reason: disabled ? '설정에서 비활성으로 지정했습니다.' : options.reason ?? '파일에 구성되어 있습니다. 세션의 실제 적용은 관측하지 않았습니다.',
    }
    const previous = this.bindings.find(item => item.resourceId === id && item.scope === options.scope)
    if (!previous) this.bindings.push(binding)
    else if (previous.precedence < binding.precedence) Object.assign(previous, binding)
  }

  markdown(file: string, kind: ResourceKind, options: SourceOptions, trustedFile = false): void {
    if (!this.exists(file)) return
    const source = this.read(file, trustedFile)
    if (!source) return
    let data: Document = {}
    let malformed = false
    // gray-matter의 javascript frontmatter 엔진을 호출하지 않는다. 본문도 metadata로 승격하지 않는다.
    const front = source.content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    if (front) {
      try { data = object(matter(`---\n${front[1]}\n---\n`).data) }
      catch { malformed = true; this.diagnostic(file, 'malformed', '문서의 YAML 메타데이터를 읽지 못해 파일명만 표시합니다.') }
    } else if (/^---\S/.test(source.content)) {
      this.diagnostic(file, 'unsupported', '실행 가능한 frontmatter 형식은 수집하지 않습니다.')
      return
    }
    const name = typeof data.name === 'string' ? data.name : path.basename(file) === 'SKILL.md' ? path.basename(path.dirname(file)) : path.basename(file, path.extname(file))
    const state = malformed ? 'unknown' : data.enabled === false || data.disabled === true ? 'disabled' : options.state
    this.add(file, source.canonical, kind, name, typeof data.description === 'string' ? data.description : '', { ...options, state, ...(malformed ? { reason: '문서 메타데이터 형식 오류로 파일 존재만 관측했습니다.' } : {}) })
  }

  directory(root: string, kind: ResourceKind, options: SourceOptions, mode: 'skills' | 'markdown' | 'config-hooks' = 'markdown'): void {
    const canonicalRoot = this.registerRoot(root)
    if (!canonicalRoot) return
    this.configured = true
    const visited = new Set<string>()
    const walk = (directory: string, depth: number): void => {
      if (depth > 8 || this.exhausted) { this.diagnostic(root, 'limit', '리소스 탐색 깊이 또는 개수 상한에 도달했습니다.'); return }
      const canonical = this.canonical(directory)
      if (!canonical || visited.has(canonical)) return
      visited.add(canonical)
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) }
      catch (error) { this.error(directory, error); return }
      for (const entry of entries) {
        if (['node_modules', '.git', 'references', 'assets', 'scripts'].includes(entry.name)) continue
        const file = path.join(directory, entry.name)
        if (entry.name.startsWith('.') && entry.name !== '.system') continue
        if (entry.isSymbolicLink() && mode === 'skills' && depth === 0) {
          // 설치된 스킬 링크에서는 SKILL.md 한 파일만 읽는다. 링크 대상 트리를 재귀 순회하지 않는다.
          const skill = path.join(file, 'SKILL.md')
          if (this.exists(skill)) {
            try {
              const target = fs.realpathSync(file)
              if (within(fs.realpathSync(skill), target)) this.markdown(skill, kind, options, true)
              else this.diagnostic(skill, 'unsupported', '스킬 패키지 경계를 벗어난 파일 링크는 수집하지 않습니다.')
            } catch (error) { this.error(skill, error) }
          }
          else this.diagnostic(file, 'missing', '스킬 링크에서 SKILL.md를 찾지 못했습니다.')
          continue
        }
        const resolved = this.canonical(file)
        if (!resolved) continue
        let stats: fs.Stats
        try { stats = fs.statSync(resolved) } catch (error) { this.error(file, error); continue }
        if (stats.isDirectory()) {
          if (mode === 'skills' && this.exists(path.join(file, 'SKILL.md'))) this.markdown(path.join(file, 'SKILL.md'), kind, options)
          else walk(file, depth + 1)
        } else if (mode === 'config-hooks' && file.endsWith('.json')) {
          const config = this.config(file)
          if (config) this.hooks(file, config, options)
        } else if (mode === 'markdown' && /\.(?:md|mdc)$/i.test(file)) this.markdown(file, kind, options)
        else if (mode === 'markdown' && kind === 'agent' && file.endsWith('.toml')) {
          const config = this.config(file)
          if (config) this.add(file, resolved, kind, typeof config.name === 'string' ? config.name : path.basename(file, '.toml'), typeof config.description === 'string' ? config.description : '', options)
        } else if (mode === 'skills' && entry.name === 'SKILL.md') this.markdown(file, kind, options)
      }
    }
    walk(root, 0)
  }

  mcp(file: string, config: Document, options: SourceOptions, disabledNames: string[] = [], namespace = ''): void {
    const canonical = this.canonical(file, true)
    if (!canonical) return
    const servers = object(config.mcpServers ?? config.mcp_servers)
    for (const [name, raw] of Object.entries(servers)) {
      const server = object(raw)
      const disabled = server.enabled === false || server.disabled === true || disabledNames.includes(name)
      const transport = typeof server.type === 'string' && ['stdio', 'http', 'sse', 'streamable-http'].includes(server.type) ? server.type : typeof server.command === 'string' ? 'stdio' : typeof server.url === 'string' ? 'http' : '미확정'
      this.add(file, canonical, 'mcp', name, `전송 방식: ${transport}. 연결 성공 여부는 관측하지 않았습니다.`, { ...options, state: disabled ? 'disabled' : options.state }, namespace + ':' + name)
    }
  }

  hooks(file: string, config: Document, options: SourceOptions): void {
    const canonical = this.canonical(file, true)
    if (!canonical) return
    for (const [event, rawGroups] of Object.entries(object(config.hooks))) {
      if (!Array.isArray(rawGroups)) continue
      rawGroups.forEach((rawGroup, groupIndex) => {
        const group = object(rawGroup)
        const handlers = Array.isArray(group.hooks) ? group.hooks : [group]
        handlers.forEach((rawHook, index) => {
          const hook = object(rawHook)
          if (!Object.keys(hook).length) return
          const type = typeof hook.type === 'string' && ['command', 'http', 'prompt', 'agent'].includes(hook.type) ? hook.type : '미확정'
          const state = config.disableAllHooks === true || hook.enabled === false || hook.disabled === true ? 'disabled' : options.state
          this.add(file, canonical, 'hook', `${event} · ${groupIndex + 1}.${index + 1}`, `이벤트: ${metadataText(event, 100)} · 유형: ${type}. 명령과 인자는 수집하지 않습니다.`, { ...options, state }, `${event}:${groupIndex}:${index}`)
        })
      })
    }
  }

  plugins(file: string, config: Document, options: SourceOptions, enabled: Document = {}): void {
    const canonical = this.canonical(file, true)
    if (!canonical) return
    const plugins = object(config.plugins)
    const disabledNames = strings(plugins.disabled)
    const enabledNames = strings(plugins.enabled)
    const names = new Set([...Object.keys(plugins).filter(name => !['paths', 'enabled', 'disabled'].includes(name)), ...disabledNames, ...enabledNames])
    for (const name of names) {
      const isDisabled = enabled[name] === false || object(plugins[name]).enabled === false || disabledNames.includes(name)
      const isEnabled = enabled[name] === true || object(plugins[name]).enabled === true || enabledNames.includes(name)
      this.add(file, canonical, 'plugin', name, '설치 manifest에서 발견했습니다. 세션 적용은 미확정입니다.', {
        ...options, state: isDisabled ? 'disabled' : isEnabled ? options.state : 'unknown',
      }, name)
    }
  }
}
