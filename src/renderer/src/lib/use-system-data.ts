import { useState, useEffect, useCallback } from 'react'
import type { AgentNode, AgentCategory, HookEvent, McpServer, RuleFile, PipelineEdge } from './types'
import { CATEGORY_COLORS } from './types'
import { api } from './api'
import staticSystemData from '../data/system-data.json'

export type SystemData = {
  agents: AgentNode[]
  hooks: HookEvent[]
  mcpServers: McpServer[]
  rules: RuleFile[]
  pipelines: PipelineEdge[]
  loading: boolean
  error: string | null
}

// 정적 JSON → 타입 변환 헬퍼
function buildFallbackAgents(): AgentNode[] {
  return staticSystemData.agents.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    tools: a.tools,
    model: a.model,
    color: CATEGORY_COLORS[a.category as AgentCategory] ?? '#738091',
    category: a.category as AgentCategory,
    ...(a.maxTurns !== undefined && { maxTurns: a.maxTurns }),
    ...(a.memory !== undefined && { memory: a.memory }),
    ...(a.isolation !== undefined && { isolation: String(a.isolation) })
  }))
}

function buildFallbackPipelines(): PipelineEdge[] {
  return staticSystemData.pipelines.flatMap((p) =>
    p.steps.map((s) => ({
      from: s.from,
      to: s.to,
      condition: s.condition,
      pipelineName: p.name
    }))
  )
}

// 정적 데이터로 초기값 설정 (Tauri 없어도 즉시 렌더 가능)
const STATIC_DATA: SystemData = {
  agents: buildFallbackAgents(),
  hooks: [],
  mcpServers: [],
  rules: [],
  pipelines: buildFallbackPipelines(),
  loading: false,
  error: null
}

/**
 * 시스템 데이터 훅.
 * Tauri IPC 사용 가능 시 → 파일시스템에서 직접 로드.
 * Vite dev 모드 → 정적 JSON 폴백 (즉시).
 */
export function useSystemData(): SystemData & { reload: () => void } {
  const [data, setData] = useState<SystemData>(STATIC_DATA)

  const load = useCallback(async () => {
    // Tauri IPC 사용 불가 → 정적 데이터 유지
    if (!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
      return
    }

    setData((prev) => ({ ...prev, loading: true, error: null }))

    try {
      // 파서는 dynamic import로 로드 (Vite dev에서 큰 번들 회피 + 코드 스플리팅).
      // api는 DataProvider와 동일하게 top-level import — 모듈 1회 평가 + 테스트 안정성.
      const { parseAgents } = await import('./parsers/agent-parser')
      const { parseHooks } = await import('./parsers/hook-parser')
      const { parseMcpServers } = await import('./parsers/mcp-parser')
      const { parseRules } = await import('./parsers/rule-parser')
      const { parsePipeline } = await import('./parsers/pipeline-parser')

      const paths = await api.getSystemPaths()

      const readFile = async (path: string): Promise<string | null> => {
        const result = await api.readFile(path)
        return result.ok ? (result.content ?? null) : null
      }

      const listDir = async (path: string): Promise<string[]> => {
        const result = await api.listDir(path)
        return result.ok ? (result.files ?? []) : []
      }

      // 에이전트 로드
      const agentFiles = await listDir(paths.agents)
      const mdFiles = agentFiles.filter((f) => f.endsWith('.md'))
      const agentContents = await Promise.all(
        mdFiles.map(async (filename) => {
          const content = await readFile(`${paths.agents}/${filename}`)
          return { filename, content: content ?? '' }
        })
      )
      const agents = parseAgents(agentContents)

      // 훅 + MCP
      const settingsContent = await readFile(paths.settings)
      let hooks: HookEvent[] = []
      let mcpServers: McpServer[] = []
      if (settingsContent) {
        try {
          const json = JSON.parse(settingsContent) as Record<string, unknown>
          hooks = parseHooks(json)
          mcpServers = parseMcpServers(json)
        } catch { /* ignore */ }
      }

      // 규칙
      const ruleFiles = await listDir(paths.rules)
      const ruleMdFiles = ruleFiles.filter((f) => f.endsWith('.md'))
      const ruleContents = await Promise.all(
        ruleMdFiles.map(async (filename) => {
          const content = await readFile(`${paths.rules}/${filename}`)
          return { filename, content: content ?? '' }
        })
      )
      const rules = parseRules(ruleContents, paths.rules)

      // 파이프라인
      const pipelineContent = await readFile(paths.pipeline)
      const pipelines = pipelineContent ? parsePipeline(pipelineContent) : []

      setData({ agents, hooks, mcpServers, rules, pipelines, loading: false, error: null })
    } catch {
      // IPC 실패 → 정적 데이터 유지
      setData(STATIC_DATA)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ~/.claude 디렉토리(또는 SSOT) 변경 감지 시 자동 reload.
  // DataProvider의 동일 패턴 이식 — agent-office 같은 useSystemData 소비자도
  // file_watcher가 emit하는 claude-system-changed 이벤트를 받아 실시간 갱신된다.
  // Vite dev/브라우저 환경(window.__TAURI_INTERNALS__ 부재)에서는 silent skip.
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    ) {
      return
    }

    let unlisten: (() => void) | null = null
    let cancelled = false

    api
      .onClaudeSystemChanged(() => {
        // 언마운트 이후 도착한 이벤트는 무시
        if (!cancelled) load()
      })
      .then((fn) => {
        if (cancelled) {
          // 등록 도중 언마운트되었으면 즉시 unlisten
          fn()
          return
        }
        unlisten = fn
      })
      .catch(() => {
        // listen 실패는 dev 환경 등 — 조용히 무시
      })

    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [load])

  return { ...data, reload: load }
}
