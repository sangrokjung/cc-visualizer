import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useAgentNodeData } from '../../src/renderer/src/features/agent-office/use-agent-node-data'
import type { AgentStatus } from '../../src/renderer/src/features/agent-office/office-config'

function makeAgentNode(id: string, status: AgentStatus = 'idle'): Node {
  return {
    id,
    type: 'agentAvatar',
    position: { x: 0, y: 0 },
    data: { agent: { id }, status, color: '#fff' },
  }
}

function makeRoomNode(id: string): Node {
  return {
    id,
    type: 'departmentZone',
    position: { x: 0, y: 0 },
    data: { category: 'development' },
  }
}

describe('useAgentNodeData', () => {
  it('상태 변경된 에이전트만 새 객체 생성', () => {
    const agent1 = makeAgentNode('a1', 'idle')
    const agent2 = makeAgentNode('a2', 'idle')
    const layout = [agent1, agent2]

    const statuses = new Map<string, AgentStatus>([
      ['a1', 'working'],
      ['a2', 'idle'],
    ])

    const { result } = renderHook(() => useAgentNodeData(layout, statuses))
    const nodes = result.current

    // a1: 상태 변경 → 새 참조
    expect(nodes[0]).not.toBe(agent1)
    expect((nodes[0].data as Record<string, unknown>).status).toBe('working')

    // a2: 상태 동일 → 기존 참조 유지
    expect(nodes[1]).toBe(agent2)
  })

  it('room/furniture 노드는 그대로 통과', () => {
    const room = makeRoomNode('room-dev')
    const agent = makeAgentNode('a1', 'idle')
    const layout = [room, agent]
    const statuses = new Map<string, AgentStatus>([['a1', 'idle']])

    const { result } = renderHook(() => useAgentNodeData(layout, statuses))

    // room은 동일 참조
    expect(result.current[0]).toBe(room)
  })

  it('매칭 없는 에이전트는 idle 기본값', () => {
    const agent = makeAgentNode('unknown', 'idle')
    const layout = [agent]
    const statuses = new Map<string, AgentStatus>()

    const { result } = renderHook(() => useAgentNodeData(layout, statuses))

    expect((result.current[0].data as Record<string, unknown>).status).toBe('idle')
    // 기존 상태와 동일하므로 같은 참조
    expect(result.current[0]).toBe(agent)
  })

  it('빈 레이아웃은 빈 배열 반환', () => {
    const statuses = new Map<string, AgentStatus>()
    const { result } = renderHook(() => useAgentNodeData([], statuses))
    expect(result.current).toEqual([])
  })
})
