import type { ViewType } from '../App'
import type { AgentNode, HookEvent, RuleFile, PipelineEdge } from './types'

// 검색 결과 항목
export type SearchResult = {
  id: string
  label: string
  description: string
  type: 'agent' | 'hook' | 'rule'
  targetView: ViewType
}

// 동적 데이터로 검색 인덱스 구축
export function buildIndex(
  agents: AgentNode[],
  pipelines: PipelineEdge[],
  hooks: HookEvent[],
  rules: RuleFile[]
): SearchResult[] {
  const results: SearchResult[] = []

  // 에이전트
  for (const agent of agents) {
    const pipelineCount = pipelines.filter(
      (p) => p.from === agent.id || p.to === agent.id
    ).length
    results.push({
      id: `agent-${agent.id}`,
      label: agent.name,
      description: `${agent.description} [${agent.category}, ${agent.model}${pipelineCount > 0 ? `, ${pipelineCount} pipelines` : ''}]`,
      type: 'agent',
      targetView: 'agent-map'
    })
  }

  // 훅 이벤트 + 매처
  const seenEvents = new Set<string>()
  const seenMatchers = new Set<string>()
  for (const hook of hooks) {
    if (!seenEvents.has(hook.event)) {
      seenEvents.add(hook.event)
      results.push({
        id: `hook-event-${hook.event}`,
        label: hook.event,
        description: 'Hook event type',
        type: 'hook',
        targetView: 'architecture'
      })
    }
    if (!seenMatchers.has(hook.matcher)) {
      seenMatchers.add(hook.matcher)
      results.push({
        id: `hook-matcher-${hook.matcher}`,
        label: hook.matcher,
        description: 'Hook matcher pattern',
        type: 'hook',
        targetView: 'architecture'
      })
    }
  }

  // Rules
  for (const rule of rules) {
    results.push({
      id: `rule-${rule.name}`,
      label: rule.name,
      description: `Rule file [${rule.priority}]`,
      type: 'rule',
      targetView: 'architecture'
    })
  }

  return results
}

export function search(
  index: SearchResult[],
  query: string,
  limit = 10
): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return index
    .filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    )
    .slice(0, limit)
}
