import { describe, it, expect } from 'vitest'
import { computeLayout, filterByCategory } from '../../src/renderer/src/features/agent-map/use-agent-graph'
import type { AgentNode, PipelineEdge, AgentCategory } from '../../src/renderer/src/lib/types'
import systemData from '../../src/renderer/src/data/system-data.json'

// 사용자 보고: 에이전트 맵 메뉴 클릭 시 검은 화면.
// 근본 원인: dagre가 pipeline의 from/to를 phantom 노드로 만들어 pos undefined → TypeError.
// 본 테스트는 실제 system-data.json(201 agents, 18 pipelines)로 throw 없이 동작함을 검증.

function makeAgent(id: string, category: AgentCategory = 'development'): AgentNode {
  return {
    id,
    name: id,
    description: '',
    tools: [],
    model: 'sonnet',
    color: '#000',
    category
  }
}

describe('computeLayout — 검은 화면 회귀 방지', () => {
  it('1: 빈 입력 → nodes/edges 빈 배열, throw 없음', () => {
    const result = computeLayout([], [])
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })

  it('2: 실제 system-data.json (201 agents)로 throw 없이 레이아웃 계산', () => {
    const agents: AgentNode[] = systemData.agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      tools: a.tools,
      model: a.model,
      color: '#000',
      category: a.category as AgentCategory,
      ...(a.isolation !== undefined && { isolation: String(a.isolation) })
    }))
    const pipelines: PipelineEdge[] = systemData.pipelines.flatMap((p) =>
      p.steps.map((s) => ({
        from: s.from,
        to: s.to,
        ...(s.condition !== undefined && { condition: s.condition }),
        pipelineName: p.name
      }))
    )
    expect(() => computeLayout(agents, pipelines)).not.toThrow()
    const { nodes, edges } = computeLayout(agents, pipelines)
    expect(nodes).toHaveLength(agents.length)
    // 모든 노드의 position이 finite 숫자 (pos undefined 폴백 검증)
    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    }
    expect(edges.length).toBeLessThanOrEqual(pipelines.length)
  })

  it('3: pipeline이 존재하지 않는 agent ID 참조해도 phantom 노드 안 만듦', () => {
    const agents = [makeAgent('a'), makeAgent('b')]
    const pipelines: PipelineEdge[] = [
      { from: 'a', to: 'b', pipelineName: 'p' },
      { from: 'a', to: 'ghost-agent', pipelineName: 'p' }, // ghost는 agents에 없음
      { from: 'unknown', to: 'b', pipelineName: 'p' }
    ]
    const { nodes, edges } = computeLayout(agents, pipelines)
    // 노드는 agents 그대로 (phantom 안 만들어짐)
    expect(nodes).toHaveLength(2)
    expect(nodes.every((n) => Number.isFinite(n.position.x))).toBe(true)
    // edges는 양쪽 모두 등록된 것 (a→b)만 dagre에 추가됐지만, 리턴 edges는 전체 pipeline 기준
    expect(edges).toHaveLength(3)
  })

  it('4: filterByCategory가 빈 category set이면 전체 반환', () => {
    const agents = [makeAgent('a', 'development'), makeAgent('b', 'marketing')]
    const pipelines: PipelineEdge[] = [{ from: 'a', to: 'b', pipelineName: 'p' }]
    const result = filterByCategory(agents, pipelines, new Set<AgentCategory>())
    expect(result.filteredAgents).toHaveLength(2)
    expect(result.filteredPipelines).toHaveLength(1)
  })

  it('5: filterByCategory가 한 category만 활성화 → 해당 agent + 양쪽이 모두 같은 cat인 pipeline만', () => {
    const agents = [
      makeAgent('a', 'development'),
      makeAgent('b', 'marketing'),
      makeAgent('c', 'development')
    ]
    const pipelines: PipelineEdge[] = [
      { from: 'a', to: 'c', pipelineName: 'p1' }, // dev → dev (유지)
      { from: 'a', to: 'b', pipelineName: 'p2' } // dev → mkt (제거)
    ]
    const result = filterByCategory(agents, pipelines, new Set(['development']))
    expect(result.filteredAgents.map((a) => a.id).sort()).toEqual(['a', 'c'])
    expect(result.filteredPipelines).toHaveLength(1)
    expect(result.filteredPipelines[0].from).toBe('a')
    expect(result.filteredPipelines[0].to).toBe('c')
  })
})
