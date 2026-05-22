import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { AGENT_CATEGORY_MAP } from '../src/renderer/src/lib/agent-category-map'

const HOME = process.env.HOME || '/Users/sangrok'

// -- 유틸리티 --

function readFileOrNull(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function safeMatter(content: string): { data: Record<string, any>; content: string } {
  try {
    const result = matter(content)
    return { data: result.data, content: result.content }
  } catch {
    // frontmatter 파싱 실패 시 수동 추출
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      const data: Record<string, any> = {}
      for (const line of fmMatch[1].split('\n')) {
        const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
        if (kv) data[kv[1]] = kv[2].trim()
      }
      const body = content.slice(fmMatch[0].length).trim()
      return { data, content: body }
    }
    return { data: {}, content }
  }
}

function listFiles(dirPath: string, ext?: string): string[] {
  try {
    const entries = fs.readdirSync(dirPath)
    if (ext) return entries.filter((f) => f.endsWith(ext))
    return entries
  } catch {
    return []
  }
}

function listDirs(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
}

function countFiles(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith('.')).length
  } catch {
    return 0
  }
}

// 에이전트 카테고리 매핑: agent-category-map.ts (단일 진실점)에서 import

// -- 카테고리 추론 (매핑에 없는 새 에이전트용) --

function inferCategory(
  description: string,
  tools: string[]
): string {
  const desc = (description || '').toLowerCase()
  const toolsStr = tools.join(' ').toLowerCase()

  // legal (먼저 체크 — 좁은 범위)
  if (/\b(?:patent|legal|contract|law)\b/.test(desc)) return 'legal'
  // review
  if (/\b(?:review|lint|code.?quality)\b/.test(desc)) return 'review'
  if (/\b(?:tdd|e2e|verify|security)\b/.test(desc)) return 'review'
  if (/\btest(?:ing|s|er)?\b/.test(desc)) return 'review'
  // creative
  if (/\b(?:design|ui|ux|web.?design|css)\b/.test(desc)) return 'creative'
  if (/\b(?:video|image|thumbnail|remotion|animation)\b/.test(desc)) return 'creative'
  // marketing
  if (/\b(?:marketing|seo|growth|campaign)\b/.test(desc)) return 'marketing'
  if (/\b(?:ads?|advertisement)\b/.test(desc)) return 'marketing'
  if (/\b(?:copywriting|content\s+(?:creation|strategy|calendar))\b/.test(desc)) return 'marketing'
  // investment
  if (/\b(?:invest|부동산|주식|real.?estate|stock|loan|대출|투자)\b/.test(desc)) return 'investment'
  // lifestyle
  if (/\b(?:사주|명리|fortune|divination)\b/.test(desc)) return 'lifestyle'
  // research
  if (/\b(?:research|analyze|data.?analy|실험|논문)\b/.test(desc)) return 'research'
  // business
  if (/\b(?:business|quotation|sales|proposal|operations|financial|accounting)\b/.test(desc)) return 'business'
  // development
  if (/\b(?:architect|build|refactor|debug|develop)\b/.test(desc)) return 'development'
  if (/\b(?:planner|planning)\b/.test(desc)) return 'development'
  if (/\b(?:documentation|docs)\b/.test(desc)) return 'development'

  // tools 기반 추론
  if (/\b(?:bash|edit|write|glob|grep)\b/.test(toolsStr)) return 'development'

  return 'operations'
}

// -- 1. 에이전트 스캔 --

interface Agent {
  id: string
  name: string
  description: string
  model: string
  tools: string[]
  category: string
  maxTurns?: number
  memory?: string
  // isolation 값은 'worktree' 같은 string으로 들어와요. 정보 보존을 위해 string으로 유지.
  isolation?: string
}

function scanAgents(): Agent[] {
  const agentsDir = path.join(HOME, '.claude/agents')
  const files = listFiles(agentsDir, '.md')

  return files.map((file) => {
    const content = readFileOrNull(path.join(agentsDir, file)) || ''
    const { data } = safeMatter(content)
    const id = file.replace('.md', '')

    const tools: string[] = Array.isArray(data.tools)
      ? data.tools
      : typeof data.tools === 'string'
        ? [data.tools]
        : []

    const description = typeof data.description === 'string'
      ? data.description.trim().split('\n')[0].trim()
      : ''

    const category = data.category || AGENT_CATEGORY_MAP[id] || inferCategory(description, tools)

    const agent: Agent = {
      id,
      name: data.name || id,
      description,
      model: data.model || 'default',
      tools,
      category,
    }

    if (data.maxTurns) agent.maxTurns = Number(data.maxTurns)
    if (data.memory) agent.memory = data.memory
    if (data.isolation !== undefined) agent.isolation = String(data.isolation)

    return agent
  })
}

// -- 2. 스킬/커맨드 스캔 --

interface Skill {
  id: string
  name: string
  description: string
  type: 'skill-dir' | 'skill-file'
  hasSubcommands: boolean
}

function scanSkills(): Skill[] {
  const commandsDir = path.join(HOME, '.claude/commands')
  const entries = listFiles(commandsDir).filter((e) => e !== '_archived')

  return entries.map((entry) => {
    const fullPath = path.join(commandsDir, entry)
    const isDir = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()

    if (isDir) {
      // 디렉토리: SKILL.md 또는 index.md에서 추출
      const skillMd = readFileOrNull(path.join(fullPath, 'SKILL.md'))
      const indexMd = readFileOrNull(path.join(fullPath, 'index.md'))
      const mainMd = readFileOrNull(path.join(fullPath, `${entry}.md`))
      const source = skillMd || indexMd || mainMd || ''

      const { data, content } = safeMatter(source)
      const name = data.name || extractH1(content) || entry
      const description = data.description || extractFirstParagraph(content) || ''

      // 하위 커맨드 확인
      const subEntries = listFiles(fullPath).filter(
        (f) => f.endsWith('.md') && !['SKILL.md', 'index.md', `${entry}.md`].includes(f)
      )

      return {
        id: entry,
        name,
        description: description.split('\n')[0].trim(),
        type: 'skill-dir' as const,
        hasSubcommands: subEntries.length > 0,
      }
    } else {
      // 단일 .md 파일
      const content = readFileOrNull(fullPath) || ''
      const { data, content: body } = safeMatter(content)
      const id = entry.replace('.md', '')
      const name = data.name || extractH1(body) || id
      const description = data.description || extractFirstParagraph(body) || ''

      return {
        id,
        name,
        description: description.split('\n')[0].trim(),
        type: 'skill-file' as const,
        hasSubcommands: false,
      }
    }
  })
}

function extractH1(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

function extractFirstParagraph(content: string): string | null {
  const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
  return lines[0]?.trim() || null
}

// -- 3. 훅 스캔 --

interface HookCommand {
  command: string
  timeout: number
  async: boolean
}

interface Hook {
  event: string
  matcher: string
  commands: HookCommand[]
}

function scanHooks(): Hook[] {
  const settingsPath = path.join(HOME, '.claude/settings.json')
  const content = readFileOrNull(settingsPath)
  if (!content) return []

  const settings = JSON.parse(content)
  const hooks: Hook[] = []

  for (const [event, matchers] of Object.entries(settings.hooks || {})) {
    for (const matcherObj of matchers as any[]) {
      const matcher = matcherObj.matcher || '*'
      const commands: HookCommand[] = (matcherObj.hooks || []).map((h: any) => ({
        command: h.command || '',
        timeout: h.timeout || 5000,
        async: h.async || false,
      }))
      hooks.push({ event, matcher, commands })
    }
  }

  return hooks
}

// -- 4. 규칙 스캔 --

interface Rule {
  id: string
  name: string
  path: string
  priority: 'critical' | 'important' | 'normal'
}

function scanRules(): Rule[] {
  const rulesDir = path.join(HOME, 'qjc-office/dotclaude/rules')
  const files = listFiles(rulesDir, '.md')

  return files.map((file) => {
    const fullPath = path.join(rulesDir, file)
    const content = readFileOrNull(fullPath) || ''
    const id = file.replace('.md', '')

    const h1Match = content.match(/^#\s+(.+)$/m)
    const name = h1Match ? h1Match[1].trim() : id

    let priority: 'critical' | 'important' | 'normal' = 'normal'
    if (/\(CRITICAL\)/i.test(content)) priority = 'critical'
    else if (/\(IMPORTANT\)/i.test(content)) priority = 'important'

    return { id, name, path: fullPath, priority }
  })
}

// -- 5. 파이프라인 스캔 --

interface PipelineStep {
  from: string
  to: string
  condition?: string
  auto: boolean
}

interface Pipeline {
  name: string
  steps: PipelineStep[]
}

function scanPipelines(): Pipeline[] {
  const pipelinePath = path.join(
    HOME,
    'qjc-office/dotclaude/reference/agent-pipeline.md'
  )
  const content = readFileOrNull(pipelinePath)
  if (!content) return []

  const pipelines: Pipeline[] = []
  let currentSection = ''

  const lines = content.split('\n')
  let inCodeBlock = false

  for (const line of lines) {
    // 섹션 헤더
    const sectionMatch = line.match(/^##\s+(.+)$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      continue
    }

    // 코드 블록 토글
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        // 파이프라인 시작
        const existingPipeline = pipelines.find((p) => p.name === currentSection)
        if (!existingPipeline) {
          pipelines.push({ name: currentSection, steps: [] })
        }
      } else {
        inCodeBlock = false
      }
      continue
    }

    if (!inCodeBlock) continue

    // 화살표 패턴: → to  또는 Phase/설명 라인은 스킵
    const arrowMatch = line.match(
      /→\s*((?:\(조건부\)\s*)?(?:\(옵션\)\s*)?)([a-zA-Z0-9_/-]+)/
    )
    if (arrowMatch) {
      const condText = arrowMatch[1].trim()
      const to = arrowMatch[2].trim()

      // from = 현재 파이프라인의 마지막 step의 to 또는 첫 번째 에이전트
      const pipeline = pipelines[pipelines.length - 1]
      const from =
        pipeline.steps.length > 0
          ? findLastAgent(pipeline, line)
          : ''

      let condition: string | undefined
      let auto = true

      if (condText.includes('조건부')) {
        // 조건 추출: # 뒤의 코멘트
        const commentMatch = line.match(/#\s*(.+)$/)
        condition = commentMatch ? commentMatch[1].trim() : '조건부'
        auto = false
      }
      if (condText.includes('옵션')) {
        condition = condition || '사용자 요청 시'
        auto = false
      }

      pipeline.steps.push({ from, to, ...(condition && { condition }), auto })
      continue
    }

    // 첫 번째 에이전트 (들여쓰기 없는 라인)
    const firstAgentMatch = line.match(/^\s*([a-zA-Z0-9_/-]+)\s*(#.*)?$/)
    if (firstAgentMatch && !line.includes('→')) {
      const pipeline = pipelines[pipelines.length - 1]
      if (pipeline && pipeline.steps.length === 0) {
        // 이것은 root 에이전트 — 다음 → 라인의 from이 됨
        pipeline.steps.push({
          from: '_root',
          to: firstAgentMatch[1].trim(),
          auto: true,
        })
      }
    }
  }

  // from 필드 보정: _root → 실제 에이전트명, 빈 from → 이전 step의 to
  for (const pipeline of pipelines) {
    let rootAgent = ''
    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i]
      if (step.from === '_root') {
        rootAgent = step.to
      } else if (!step.from && i > 0) {
        // 들여쓰기 기반: 직전 라인의 에이전트가 from
        step.from = findParentAgent(pipeline.steps, i)
      }
    }
    // _root 제거 후 from 보정
    if (pipeline.steps.length > 0 && pipeline.steps[0].from === '_root') {
      rootAgent = pipeline.steps[0].to
      pipeline.steps.shift()
      for (const step of pipeline.steps) {
        if (!step.from) step.from = rootAgent
      }
    }
  }

  return pipelines.filter((p) => p.steps.length > 0)
}

function findLastAgent(pipeline: Pipeline, _line: string): string {
  if (pipeline.steps.length === 0) return ''
  return pipeline.steps[pipeline.steps.length - 1].to
}

function findParentAgent(steps: PipelineStep[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    return steps[i].to
  }
  return ''
}

// -- 6. MCP 서버 스캔 --

interface McpServer {
  name: string
  command: string
  args: string[]
  projectPath: string
}

function scanMcpServers(): McpServer[] {
  const servers: McpServer[] = []

  // .mcp.json 파일들 스캔
  const searchDirs = [
    HOME,
    path.join(HOME, 'projects'),
  ]

  for (const searchDir of searchDirs) {
    try {
      const entries = fs.readdirSync(searchDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const mcpPath = path.join(searchDir, entry.name, '.mcp.json')
        const content = readFileOrNull(mcpPath)
        if (!content) continue

        try {
          const data = JSON.parse(content)
          const mcpServers = data.mcpServers || {}
          for (const [name, cfg] of Object.entries(mcpServers)) {
            const config = cfg as any
            servers.push({
              name,
              command: config.command || '',
              args: config.args || [],
              projectPath: path.join(searchDir, entry.name),
            })
          }
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    } catch {
      // 디렉토리 없음 무시
    }
  }

  return servers
}

// -- 7. 메모리 시스템 스캔 --

interface MemorySystem {
  autoMemory: {
    path: string
    fileCount: number
    files: string[]
  }
  agentMemory: {
    path: string
    agents: Array<{ name: string; fileCount: number }>
  }
  personalOS: {
    path: string
    directories: string[]
  }
}

// 홈 디렉토리를 Claude Code 프로젝트 폴더 인코딩으로 변환
// 예: /Users/sangrok → -Users-sangrok (직원마다 다름, 하드코딩 금지)
function encodeHomeProjectDir(): string {
  return HOME.replace(/\//g, '-')
}

function scanMemory(): MemorySystem {
  const autoMemoryPath = path.join(
    HOME,
    `.claude/projects/${encodeHomeProjectDir()}/memory`
  )
  const autoFiles = listFiles(autoMemoryPath)

  const agentMemoryPath = path.join(HOME, '.claude/agent-memory')
  const agentDirs = listDirs(agentMemoryPath)
  const agents = agentDirs.map((name) => ({
    name,
    fileCount: countFiles(path.join(agentMemoryPath, name)),
  }))

  const personalOSPath = path.join(HOME, 'qjc-office/personal-os')
  const personalDirs = listDirs(personalOSPath)

  return {
    autoMemory: {
      path: autoMemoryPath,
      fileCount: autoFiles.length,
      files: autoFiles,
    },
    agentMemory: {
      path: agentMemoryPath,
      agents,
    },
    personalOS: {
      path: personalOSPath,
      directories: personalDirs,
    },
  }
}

// -- 메인 실행 --

function main() {
  console.log('Scanning Claude Code system...\n')

  const agents = scanAgents()
  console.log(`  Agents: ${agents.length}`)

  const skills = scanSkills()
  console.log(`  Skills: ${skills.length}`)

  const hooks = scanHooks()
  console.log(`  Hooks: ${hooks.length} matchers (${hooks.reduce((sum, h) => sum + h.commands.length, 0)} commands)`)

  const rules = scanRules()
  console.log(`  Rules: ${rules.length}`)

  const pipelines = scanPipelines()
  console.log(`  Pipelines: ${pipelines.length}`)

  const mcpServers = scanMcpServers()
  console.log(`  MCP Servers: ${mcpServers.length}`)

  const memory = scanMemory()
  console.log(`  Memory: auto(${memory.autoMemory.fileCount}), agents(${memory.agentMemory.agents.length}), personalOS(${memory.personalOS.directories.length})`)

  const systemData = {
    scanTimestamp: new Date().toISOString(),
    agents,
    skills,
    hooks,
    rules,
    pipelines,
    mcpServers,
    memory,
    stats: {
      agentCount: agents.length,
      skillCount: skills.length,
      hookCount: hooks.reduce((sum, h) => sum + h.commands.length, 0),
      ruleCount: rules.length,
      pipelineCount: pipelines.length,
      mcpServerCount: mcpServers.length,
    },
  }

  // SCAN_OUTPUT_DIR 환경변수가 있으면 해당 디렉토리에 저장 (직원 머신 캐시 경로).
  // 없으면 기존 소스 트리 경로 (개발 워크플로우 유지).
  const outputDir = process.env.SCAN_OUTPUT_DIR
    ? process.env.SCAN_OUTPUT_DIR
    : path.join(__dirname, '../src/renderer/src/data')
  const outputPath = path.join(outputDir, 'system-data.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(systemData, null, 2), 'utf-8')

  console.log(`\nOutput: ${outputPath}`)
  console.log('Done.')
}

main()
