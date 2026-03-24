import { AgentNodeSchema, type AgentNode, type AgentCategory } from '../types'

// 경량 frontmatter 파서 (gray-matter 대체 — Vite renderer에서 eval/fs 의존 없이 동작)
function parseFrontmatter(content: string): { data: Record<string, unknown> } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { data: {} }

  const yaml = match[1]
  const data: Record<string, unknown> = {}
  let currentKey = ''
  let multilineValue = ''
  let inMultiline = false
  let arrayCollecting = false
  let arrayKey = ''
  let arrayValues: string[] = []

  for (const line of yaml.split('\n')) {
    const trimmed = line.trimEnd()

    // 배열 항목 수집 중
    if (arrayCollecting) {
      const itemMatch = trimmed.match(/^\s+-\s+["']?(.+?)["']?\s*$/)
      if (itemMatch) {
        arrayValues.push(itemMatch[1])
        continue
      } else {
        data[arrayKey] = arrayValues
        arrayCollecting = false
        arrayValues = []
      }
    }

    // multiline 블록 수집 중
    if (inMultiline) {
      if (/^\S/.test(trimmed) && trimmed.includes(':')) {
        data[currentKey] = multilineValue.trim()
        inMultiline = false
      } else {
        multilineValue += trimmed.trim() + ' '
        continue
      }
    }

    const kv = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/)
    if (!kv) continue

    const [, key, value] = kv

    if (value === '|' || value === '>') {
      currentKey = key
      multilineValue = ''
      inMultiline = true
    } else if (value.startsWith('[')) {
      // 인라인 배열: ["Read", "Write", "Bash"]
      try {
        data[key] = JSON.parse(value.replace(/'/g, '"'))
      } catch {
        data[key] = []
      }
    } else if (value === '') {
      // 다음 줄부터 YAML 배열 (- item) 가능
      arrayCollecting = true
      arrayKey = key
      arrayValues = []
    } else {
      // 스칼라 값
      let v: string | number | boolean = value.replace(/^["']|["']$/g, '')
      if (v === 'true') data[key] = true
      else if (v === 'false') data[key] = false
      else if (/^\d+$/.test(v)) data[key] = parseInt(v, 10)
      else data[key] = v
    }
  }

  if (inMultiline) data[currentKey] = multilineValue.trim()
  if (arrayCollecting) data[arrayKey] = arrayValues

  return { data }
}

// color -> category 추론 매핑
const COLOR_TO_CATEGORY: Record<string, AgentCategory> = {
  blue: 'development',
  cyan: 'development',
  green: 'marketing',
  magenta: 'creative',
  yellow: 'legal',
  red: 'review'
}

// description 키워드 기반 카테고리 보정
const DESCRIPTION_CATEGORY_HINTS: Array<{ keywords: string[]; category: AgentCategory }> = [
  { keywords: ['review', 'reviewer', 'code review'], category: 'review' },
  { keywords: ['business', 'quotation', 'financial', 'accountant'], category: 'business' },
  { keywords: ['operations', 'email', 'doc-updater'], category: 'operations' },
  { keywords: ['research'], category: 'research' },
  { keywords: ['legal', 'contract', 'patent'], category: 'legal' },
  { keywords: ['marketing', 'ad ', 'seo', 'growth'], category: 'marketing' },
  { keywords: ['creative', 'copywriting', 'content', 'designer', 'remotion'], category: 'creative' }
]

// system-data.md에서 정의한 에이전트→카테고리 정적 매핑
const KNOWN_AGENT_CATEGORIES: Record<string, AgentCategory> = {
  architect: 'development',
  'build-error-resolver': 'development',
  'e2e-runner': 'development',
  planner: 'development',
  'refactor-cleaner': 'development',
  'tdd-guide': 'development',
  'verify-agent': 'development',
  'code-reviewer': 'review',
  'codex-reviewer': 'review',
  'database-reviewer': 'review',
  'gemini-reviewer': 'review',
  'security-reviewer': 'review',
  'financial-accountant': 'business',
  'product-strategist': 'business',
  'qjc-business': 'business',
  quotation: 'business',
  'ad-compass': 'marketing',
  'ad-optimizer-team': 'marketing',
  'ad-scout-google': 'marketing',
  'ad-scout-meta': 'marketing',
  'performance-growth-marketer': 'marketing',
  'seo-geo-aeo-strategist': 'marketing',
  copywriting: 'creative',
  'qjc-content': 'creative',
  'remotion-creator': 'creative',
  'web-designer': 'creative',
  researcher: 'research',
  'contract-legal': 'legal',
  'patent-attorney': 'legal',
  'doc-updater': 'operations',
  'email-action-team': 'operations',
  'qjc-operations': 'operations'
}

function inferCategory(name: string, color: string, description: string): AgentCategory {
  // 1순위: 정적 매핑
  if (KNOWN_AGENT_CATEGORIES[name]) {
    return KNOWN_AGENT_CATEGORIES[name]
  }

  // 2순위: description 키워드
  const lowerDesc = description.toLowerCase()
  for (const hint of DESCRIPTION_CATEGORY_HINTS) {
    if (hint.keywords.some((kw) => lowerDesc.includes(kw))) {
      return hint.category
    }
  }

  // 3순위: color 기반
  if (COLOR_TO_CATEGORY[color]) {
    return COLOR_TO_CATEGORY[color]
  }

  return 'development'
}

/**
 * 단일 에이전트 .md 파일 내용을 파싱한다.
 * @param content - 파일 전체 내용 (문자열)
 * @param filename - 파일명 (확장자 포함, e.g. "architect.md")
 * @returns AgentNode | null (파싱 실패 시 null)
 */
export function parseAgent(content: string, filename: string): AgentNode | null {
  if (!content.trim()) return null

  try {
    const { data } = parseFrontmatter(content)
    if (!data.name) return null

    const id = filename.replace(/\.md$/, '')
    const color = typeof data.color === 'string' ? data.color : 'blue'
    const description = typeof data.description === 'string' ? data.description.trim() : ''

    const category = inferCategory(id, color, description)

    const raw = {
      id,
      name: data.name,
      description,
      tools: Array.isArray(data.tools) ? data.tools : [],
      model: typeof data.model === 'string' ? data.model : 'sonnet',
      color,
      category,
      maxTurns: typeof data.maxTurns === 'number' ? data.maxTurns : undefined,
      memory: typeof data.memory === 'string' ? data.memory : undefined,
      isolation: typeof data.isolation === 'string' ? data.isolation : undefined
    }

    return AgentNodeSchema.parse(raw)
  } catch {
    return null
  }
}

/**
 * 여러 에이전트 파일을 한꺼번에 파싱한다.
 * @param files - { filename, content } 배열
 * @returns AgentNode[] (파싱 실패한 항목은 제외)
 */
export function parseAgents(
  files: Array<{ filename: string; content: string }>
): AgentNode[] {
  return files
    .map((f) => parseAgent(f.content, f.filename))
    .filter((node): node is AgentNode => node !== null)
}
