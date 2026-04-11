import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePipelineEdges } from '../../src/renderer/src/features/agent-office/use-pipeline-edges'
import type { AgentNode, PipelineEdge } from '../../src/renderer/src/lib/types'

function makeAgent(overrides: Partial<AgentNode> = {}): AgentNode {
  return {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'reviews code',
    tools: [],
    model: 'sonnet',
    color: '#6366f1',
    category: 'review',
    ...overrides,
  }
}

function makePipeline(
  from: string,
  to: string,
  pipelineName = 'Test Pipeline'
): PipelineEdge {
  return { from, to, pipelineName }
}

describe('usePipelineEdges', () => {
  it('selectedAgent가 null이면 빈 배열 반환', () => {
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines: [makePipeline('a', 'b')],
        selectedAgent: null,
        layoutAgentIds: new Set(['a', 'b']),
      })
    )
    expect(result.current).toEqual([])
  })

  it('선택된 에이전트가 from인 엣지만 포함', () => {
    const pipelines: PipelineEdge[] = [
      makePipeline('code-reviewer', 'security-reviewer', '코드리뷰 파이프라인'),
      makePipeline('planner', 'tdd-guide', '구현 파이프라인'),
    ]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'code-reviewer' }),
        layoutAgentIds: new Set([
          'code-reviewer',
          'security-reviewer',
          'planner',
          'tdd-guide',
        ]),
      })
    )
    expect(result.current).toHaveLength(1)
    expect(result.current[0].source).toBe('code-reviewer')
    expect(result.current[0].target).toBe('security-reviewer')
  })

  it('선택된 에이전트가 to인 엣지도 포함', () => {
    const pipelines: PipelineEdge[] = [
      makePipeline('code-reviewer', 'security-reviewer'),
    ]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'security-reviewer', category: 'review' }),
        layoutAgentIds: new Set(['code-reviewer', 'security-reviewer']),
      })
    )
    expect(result.current).toHaveLength(1)
    expect(result.current[0].target).toBe('security-reviewer')
  })

  it('layoutAgentIds에 없는 노드가 포함된 엣지는 제외', () => {
    const pipelines: PipelineEdge[] = [
      makePipeline('code-reviewer', 'ghost-agent'),
    ]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'code-reviewer' }),
        layoutAgentIds: new Set(['code-reviewer']), // ghost-agent 제외
      })
    )
    expect(result.current).toEqual([])
  })

  it('같은 from→to 쌍은 여러 pipelineName에 있어도 한 번만 포함', () => {
    const pipelines: PipelineEdge[] = [
      makePipeline('code-reviewer', 'security-reviewer', '코드리뷰 파이프라인'),
      makePipeline('code-reviewer', 'security-reviewer', '보안 파이프라인'),
    ]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'code-reviewer' }),
        layoutAgentIds: new Set(['code-reviewer', 'security-reviewer']),
      })
    )
    expect(result.current).toHaveLength(1)
    expect(result.current[0].label).toBe('코드리뷰 파이프라인')
  })

  it('ariaLabel 포맷 검증', () => {
    const pipelines: PipelineEdge[] = [
      makePipeline('a', 'b', 'Test Pipeline'),
    ]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'a', category: 'development' }),
        layoutAgentIds: new Set(['a', 'b']),
      })
    )
    expect(result.current[0].ariaLabel).toBe('a에서 b로 — Test Pipeline')
  })

  it('엣지 속성 (animated, type, zIndex) 검증', () => {
    const pipelines: PipelineEdge[] = [makePipeline('a', 'b')]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'a', category: 'development' }),
        layoutAgentIds: new Set(['a', 'b']),
      })
    )
    expect(result.current[0].animated).toBe(true)
    expect(result.current[0].type).toBe('smoothstep')
    expect(result.current[0].zIndex).toBe(1000)
  })

  it('관련 없는 파이프라인은 모두 제외', () => {
    const pipelines: PipelineEdge[] = [
      makePipeline('x', 'y'),
      makePipeline('y', 'z'),
    ]
    const { result } = renderHook(() =>
      usePipelineEdges({
        pipelines,
        selectedAgent: makeAgent({ id: 'code-reviewer' }),
        layoutAgentIds: new Set(['x', 'y', 'z', 'code-reviewer']),
      })
    )
    expect(result.current).toEqual([])
  })
})
