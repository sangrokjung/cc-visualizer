import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import type { AgentStatus } from './office-config'

// 레이아웃 노드에 상태 데이터를 오버레이하는 훅.
// useOfficeLayout(static)과 분리하여 5초 tick에서 위치 재계산 방지.
// 변경된 에이전트만 새 객체 생성 → AgentAvatarNode memo가 나머지 skip.
export function useAgentNodeData(
  layoutNodes: Node[],
  statuses: Map<string, AgentStatus>
): Node[] {
  return useMemo(() => {
    return layoutNodes.map((node) => {
      if (node.type !== 'agentAvatar') return node

      const status = statuses.get(node.id) ?? 'idle'
      const prevStatus = (node.data as Record<string, unknown>).status

      // 같은 상태면 기존 참조 유지 → React.memo skip
      if (prevStatus === status) return node

      return { ...node, data: { ...node.data, status } }
    })
  }, [layoutNodes, statuses])
}
