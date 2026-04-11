// 파이프라인 엣지 훅
// 선택된 에이전트의 in/out 파이프라인 엣지만 React Flow Edge[]로 변환한다.
// 전체 18개 파이프라인을 모두 그리면 그래프가 난잡해지므로 선택 기반 하이라이트만 지원.

import { useMemo } from 'react'
import { MarkerType, type Edge } from '@xyflow/react'
import type { AgentNode as AgentNodeData, PipelineEdge } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'

interface UsePipelineEdgesInput {
  pipelines: PipelineEdge[]
  selectedAgent: AgentNodeData | null
  layoutAgentIds: Set<string>
}

export function usePipelineEdges({
  pipelines,
  selectedAgent,
  layoutAgentIds,
}: UsePipelineEdgesInput): Edge[] {
  return useMemo(() => {
    if (!selectedAgent) return []

    const stroke = CATEGORY_COLORS[selectedAgent.category] ?? '#ABB3BF'
    const seen = new Set<string>()
    const out: Edge[] = []

    for (const p of pipelines) {
      const involvesSelected = p.from === selectedAgent.id || p.to === selectedAgent.id
      if (!involvesSelected) continue
      // 레이아웃에 실제로 존재하는 노드끼리만 연결
      if (!layoutAgentIds.has(p.from) || !layoutAgentIds.has(p.to)) continue

      // 같은 from→to 쌍이 여러 pipelineName에 존재할 경우 첫 번째만 유지
      const key = `${p.from}→${p.to}`
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        id: `pipe-${p.from}-${p.to}-${out.length}`,
        source: p.from,
        target: p.to,
        type: 'smoothstep',
        animated: true,
        label: p.pipelineName,
        labelBgStyle: { fill: '#0d0f14', fillOpacity: 0.9 },
        labelStyle: { fill: '#ABB3BF', fontSize: 10, fontFamily: 'monospace' },
        style: { stroke, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        ariaLabel: `${p.from}에서 ${p.to}로 — ${p.pipelineName}`,
        zIndex: 1000,
      })
    }

    return out
  }, [pipelines, selectedAgent, layoutAgentIds])
}
