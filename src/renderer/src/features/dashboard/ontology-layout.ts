import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

// 팔란티어 온톨로지 카테고리 색상
export const PALANTIR_CATEGORY_COLORS: Record<string, string> = {
  marketing: '#29A634',
  review: '#7961DB',
  development: '#2D72D2',
  creative: '#DB2C6F',
  research: '#00A396',
  business: '#D1980B',
  legal: '#D33D17',
  operations: '#147EB3'
}

// 에이전트 노드 크기
const AGENT_NODE_WIDTH = 240
const AGENT_NODE_HEIGHT = 90

// 스킬 노드 크기
const SKILL_NODE_WIDTH = 96
const SKILL_NODE_HEIGHT = 48

interface SystemAgent {
  id: string
  name: string
  description: string
  model: string
  tools: string[]
  category: string
  maxTurns?: number
  memory?: string
}

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

export interface SystemData {
  agents: SystemAgent[]
  pipelines: Pipeline[]
}

export interface OntologyNodeData {
  label: string
  description: string
  model: string
  tools: string[]
  category: string
  selected: boolean
  nodeKind: 'agent' | 'skill'
  [key: string]: unknown
}

/**
 * 파이프라인 스텝에서 스킬 노드 ID 추출
 * "/" 로 시작하면 스킬 노드
 */
function isSkillId(id: string): boolean {
  return id.startsWith('/')
}

/**
 * dagre 기반 온톨로지 그래프 빌드
 * 에이전트 + 스킬 노드를 LR 방향으로 배치
 */
export function buildOntologyGraph(
  systemData: SystemData,
  activeFilter: string | null,
  selectedNodeId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 })

  // 에이전트 ID 셋 (빠른 조회용)
  const agentIdSet = new Set(systemData.agents.map((a) => a.id))

  // 파이프라인에 등장하는 스킬 노드 수집
  const skillNodes = new Map<string, string>()
  systemData.pipelines.forEach((pipeline) => {
    pipeline.steps.forEach((step) => {
      if (step.from && isSkillId(step.from)) {
        skillNodes.set(step.from, step.from.slice(1))
      }
      if (step.to && isSkillId(step.to)) {
        skillNodes.set(step.to, step.to.slice(1))
      }
    })
  })

  // dagre에 에이전트 노드 등록
  systemData.agents.forEach((agent) => {
    g.setNode(agent.id, { width: AGENT_NODE_WIDTH, height: AGENT_NODE_HEIGHT })
  })

  // dagre에 스킬 노드 등록
  skillNodes.forEach((_, skillId) => {
    g.setNode(skillId, { width: SKILL_NODE_WIDTH, height: SKILL_NODE_HEIGHT })
  })

  // dagre에 엣지 등록
  const edgeEntries: { from: string; to: string; condition?: string; auto: boolean; pipelineName: string }[] = []
  systemData.pipelines.forEach((pipeline) => {
    pipeline.steps.forEach((step) => {
      // 빈 from은 건너뜀 (진입점)
      if (!step.from) return
      const from = step.from
      const to = step.to
      // source/target이 에이전트 또는 스킬에 존재하는지 확인
      const fromExists = agentIdSet.has(from) || skillNodes.has(from)
      const toExists = agentIdSet.has(to) || skillNodes.has(to)
      if (fromExists && toExists) {
        g.setEdge(from, to)
        edgeEntries.push({ from, to, condition: step.condition, auto: step.auto, pipelineName: pipeline.name })
      }
    })
  })

  dagre.layout(g)

  // 노드 생성
  const nodes: Node[] = []

  systemData.agents.forEach((agent) => {
    const pos = g.node(agent.id)
    if (!pos) return
    // 필터 규약: null=전체, 'agents'=에이전트 표시, 'skills'=에이전트 dim, 카테고리명=해당만, 기타=dim
    const isFiltered = (() => {
      if (!activeFilter) return false
      if (activeFilter === 'agents') return false
      if (activeFilter === 'skills') return true
      if (PALANTIR_CATEGORY_COLORS[activeFilter]) return agent.category !== activeFilter
      return true
    })()
    const nodeData: OntologyNodeData = {
      label: agent.name,
      description: agent.description,
      model: agent.model,
      tools: agent.tools,
      category: agent.category,
      selected: selectedNodeId === agent.id,
      nodeKind: 'agent'
    }
    nodes.push({
      id: agent.id,
      type: 'ontologyNode',
      position: { x: pos.x - AGENT_NODE_WIDTH / 2, y: pos.y - AGENT_NODE_HEIGHT / 2 },
      data: nodeData,
      style: isFiltered ? { opacity: 0.2 } : undefined
    })
  })

  skillNodes.forEach((label, skillId) => {
    const pos = g.node(skillId)
    if (!pos) return
    // 필터 규약: null=전체, 'skills'=스킬 표시, 나머지=dim
    const isFiltered = (() => {
      if (!activeFilter) return false
      if (activeFilter === 'skills') return false
      return true
    })()
    const nodeData: OntologyNodeData = {
      label,
      description: '',
      model: '',
      tools: [],
      category: '',
      selected: selectedNodeId === skillId,
      nodeKind: 'skill'
    }
    nodes.push({
      id: skillId,
      type: 'skillNode',
      position: { x: pos.x - SKILL_NODE_WIDTH / 2, y: pos.y - SKILL_NODE_HEIGHT / 2 },
      data: nodeData,
      style: isFiltered ? { opacity: 0.2 } : undefined
    })
  })

  // 엣지 생성
  const edges: Edge[] = edgeEntries.map((entry, i) => {
    const isSelected =
      selectedNodeId !== null && (entry.from === selectedNodeId || entry.to === selectedNodeId)
    const isConditional = !!entry.condition

    return {
      id: `oe-${entry.from}-${entry.to}-${i}`,
      source: entry.from,
      target: entry.to,
      label: entry.condition ?? '',
      animated: isSelected,
      style: {
        stroke: isSelected ? '#4C90F0' : '#404854',
        strokeWidth: isSelected ? 2 : 1.5,
        ...(isConditional ? { strokeDasharray: '6 3' } : {})
      },
      labelStyle: { fill: '#ABB3BF', fontSize: 9 }
    }
  })

  return { nodes, edges }
}
