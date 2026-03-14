import { useState, useEffect, useCallback } from 'react'
import type { AgentNode, HookEvent, McpServer, RuleFile, PipelineEdge } from './types'
import { parseAgents } from './parsers/agent-parser'
import { parseHooks } from './parsers/hook-parser'
import { parseMcpServers } from './parsers/mcp-parser'
import { parseRules } from './parsers/rule-parser'
import { parsePipeline } from './parsers/pipeline-parser'

export type SystemData = {
  agents: AgentNode[]
  hooks: HookEvent[]
  mcpServers: McpServer[]
  rules: RuleFile[]
  pipelines: PipelineEdge[]
  loading: boolean
  error: string | null
}

const INITIAL: SystemData = {
  agents: [],
  hooks: [],
  mcpServers: [],
  rules: [],
  pipelines: [],
  loading: true,
  error: null
}

async function readFile(path: string): Promise<string | null> {
  const result = await window.electronAPI.readFile(path)
  return result.ok ? (result.content ?? null) : null
}

async function listDir(path: string): Promise<string[]> {
  const result = await window.electronAPI.listDir(path)
  return result.ok ? (result.files ?? []) : []
}

async function loadAgents(agentsDir: string): Promise<AgentNode[]> {
  const filenames = await listDir(agentsDir)
  const mdFiles = filenames.filter((f) => f.endsWith('.md'))

  const files = await Promise.all(
    mdFiles.map(async (filename) => {
      const content = await readFile(`${agentsDir}/${filename}`)
      return { filename, content: content ?? '' }
    })
  )

  return parseAgents(files)
}

async function loadHooksAndMcp(
  settingsPath: string
): Promise<{ hooks: HookEvent[]; mcpServers: McpServer[] }> {
  const content = await readFile(settingsPath)
  if (!content) return { hooks: [], mcpServers: [] }

  try {
    const json = JSON.parse(content) as Record<string, unknown>
    return {
      hooks: parseHooks(json),
      mcpServers: parseMcpServers(json)
    }
  } catch {
    return { hooks: [], mcpServers: [] }
  }
}

async function loadRules(rulesDir: string): Promise<RuleFile[]> {
  const filenames = await listDir(rulesDir)
  const mdFiles = filenames.filter((f) => f.endsWith('.md'))

  const files = await Promise.all(
    mdFiles.map(async (filename) => {
      const content = await readFile(`${rulesDir}/${filename}`)
      return { filename, content: content ?? '' }
    })
  )

  return parseRules(files, rulesDir)
}

async function loadPipelines(pipelinePath: string): Promise<PipelineEdge[]> {
  const content = await readFile(pipelinePath)
  return content ? parsePipeline(content) : []
}

/**
 * 시스템 데이터를 IPC로 읽고 파서로 파싱하는 훅.
 * 마운트 시 1회 로드, reload()로 수동 갱신 가능.
 */
export function useSystemData(): SystemData & { reload: () => void } {
  const [data, setData] = useState<SystemData>(INITIAL)

  const load = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const paths = await window.electronAPI.getSystemPaths()

      const [agents, { hooks, mcpServers }, rules, pipelines] =
        await Promise.all([
          loadAgents(paths.agents),
          loadHooksAndMcp(paths.settings),
          loadRules(paths.rules),
          loadPipelines(paths.pipeline)
        ])

      setData({ agents, hooks, mcpServers, rules, pipelines, loading: false, error: null })
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err)
      }))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { ...data, reload: load }
}
