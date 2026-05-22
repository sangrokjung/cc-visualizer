import dagre from 'dagre'
import { MarkerType, type Node, type Edge } from '@xyflow/react'
import type { AgentNode as AgentNodeData, AgentCategory, PipelineEdge } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'

// re-export (AgentNode, AgentDetailPanel 등이 여기서 import)
export { CATEGORY_COLORS }

export const CATEGORY_LABELS: Record<AgentCategory, string> = {
  development: '개발',
  review: '리뷰',
  business: '비즈니스',
  marketing: '마케팅',
  creative: '크리에이티브',
  research: '리서치',
  legal: '법무',
  operations: '운영',
  investment: '투자',
  lifestyle: '라이프'
}

// --- dagre 레이아웃 계산 ---
const NODE_WIDTH = 200
const NODE_HEIGHT = 80

export function computeLayout(
  agents: AgentNodeData[],
  pipelines: PipelineEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 })

  // 빈 그래프 가드 — dagre가 빈 그래프에서 throw할 수 있어요
  if (agents.length === 0) {
    return { nodes: [], edges: [] }
  }

  // 에이전트 ID 집합 — pipeline에 등록되지 않은 ID를 dagre가 phantom 노드로 만들지 않게 필터
  const agentIds = new Set(agents.map((a) => a.id))

  agents.forEach((agent) => {
    g.setNode(agent.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  pipelines.forEach((p) => {
    if (agentIds.has(p.from) && agentIds.has(p.to)) {
      g.setEdge(p.from, p.to)
    }
  })

  dagre.layout(g)

  const nodes: Node[] = agents.map((agent, idx) => {
    const pos = g.node(agent.id)
    // dagre가 위치를 못 잡으면 grid 폴백 — 검은 화면 방지
    const x = pos?.x ?? (idx % 20) * (NODE_WIDTH + 40) + NODE_WIDTH / 2
    const y = pos?.y ?? Math.floor(idx / 20) * (NODE_HEIGHT + 40) + NODE_HEIGHT / 2
    return {
      id: agent.id,
      type: 'agentNode',
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: agent
    }
  })

  const edges: Edge[] = pipelines.map((p, i) => {
    const isConditional = !!p.condition
    return {
      id: `e-${p.pipelineName}-${p.from}-${p.to}-${i}`,
      source: p.from,
      target: p.to,
      type: 'smoothstep',
      animated: true,
      label: p.condition ?? '',
      style: {
        stroke: isConditional ? '#D1980B' : '#404854',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isConditional ? '#D1980B' : '#404854',
        width: 20,
        height: 20,
      },
      labelStyle: {
        fill: '#ABB3BF',
        fontSize: 11,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: '#1C2127',
        stroke: '#404854',
        strokeWidth: 1,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    }
  })

  return { nodes, edges }
}

// --- 카테고리 필터 ---
export function filterByCategory(
  agents: AgentNodeData[],
  pipelines: PipelineEdge[],
  activeCategories: Set<AgentCategory>
): { filteredAgents: AgentNodeData[]; filteredPipelines: PipelineEdge[] } {
  if (activeCategories.size === 0) {
    return { filteredAgents: agents, filteredPipelines: pipelines }
  }

  const filteredAgents = agents.filter((a) => activeCategories.has(a.category))
  const agentIds = new Set(filteredAgents.map((a) => a.id))
  const filteredPipelines = pipelines.filter(
    (p) => agentIds.has(p.from) && agentIds.has(p.to)
  )

  return { filteredAgents, filteredPipelines }
}
