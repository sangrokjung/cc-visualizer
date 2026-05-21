import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  useNodesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { AgentNode as AgentNodeData, AgentCategory } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'
import { useSystemData } from '../../lib/use-system-data'
import { useSessionEventsContext } from '../../lib/SessionEventsProvider'
import { useAgentStatuses } from './use-agent-status'
import { JARVIS } from './office-config'
import { useOfficeLayout } from './use-office-layout'
import { useAgentNodeData } from './use-agent-node-data'
import { usePipelineEdges } from './use-pipeline-edges'
import { useLiveRegion } from './use-live-region'
import DepartmentZoneNode from './nodes/DepartmentZoneNode'
import AgentAvatarNode from './nodes/AgentAvatarNode'
import FurnitureNode from './nodes/FurnitureNode'
import OfficeKpiStrip from './OfficeKpiStrip'
import OfficeFilterPanel from './OfficeFilterPanel'
import OfficeInsightPanel from './OfficeInsightPanel'

const nodeTypes = {
  departmentZone: DepartmentZoneNode,
  agentAvatar: AgentAvatarNode,
  furniture: FurnitureNode
}

export default function AgentOfficeView() {
  const { agents, pipelines, loading } = useSystemData()
  const { events: recentEvents, recentTools } = useSessionEventsContext()
  const [activeCategories, setActiveCategories] = useState<Set<AgentCategory>>(new Set())
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(null)

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents])
  const { statuses, demoMode } = useAgentStatuses(agentIds)
  const layoutAgentIds = useMemo(() => new Set(agentIds), [agentIds])

  // 레이아웃 계산 (static) + 상태 오버레이 (dynamic) 분리
  const baseLayout = useOfficeLayout({ agents, activeCategories, pipelines })
  const layoutNodes = useAgentNodeData(baseLayout, statuses)
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const pipelineEdges = usePipelineEdges({ pipelines, selectedAgent, layoutAgentIds })
  useEffect(() => { setNodes(layoutNodes) }, [layoutNodes, setNodes])

  const uniqueToolCount = useMemo(() => {
    const s = new Set<string>()
    for (const a of agents) for (const t of a.tools) s.add(t)
    return s.size
  }, [agents])

  const toggleCategory = useCallback((cat: AgentCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type !== 'agentAvatar') return
    const agent = agents.find((a) => a.id === node.id)
    if (agent) setSelectedAgent(agent)
  }, [agents])

  const onPaneClick = useCallback(() => { setSelectedAgent(null) }, [])
  const liveAnnouncement = useLiveRegion(statuses)

  if (loading && agents.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm" style={{ color: '#ABB3BF' }}>데이터 로딩 중...</div>
  }
  if (!loading && agents.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6"
        style={{ backgroundColor: '#0d0f14', color: '#C5CBD3' }} data-testid="agent-office-empty">
        <span className="text-4xl" aria-hidden="true">🏢</span>
        <p className="text-sm text-center">에이전트를 찾지 못했습니다.</p>
        <p className="text-xs text-center" style={{ color: '#ABB3BF' }}>~/.claude/agents 디렉토리에 .md 파일을 추가하세요.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 접근성: 라이브 리전 */}
      <div aria-live="polite" className="sr-only" data-testid="office-live-region">{liveAnnouncement}</div>

      {/* KPI 스트립 */}
      <OfficeKpiStrip statuses={statuses} pipelineCount={pipelines.length} toolCount={uniqueToolCount} demoMode={demoMode} />

      {/* 3컬럼 레이아웃 — 패널 폭 확대로 가독성 개선 */}
      <div className="flex-1 grid grid-cols-[240px_1fr_320px] overflow-hidden">
        <OfficeFilterPanel
          agents={agents}
          activeCategories={activeCategories}
          onToggleCategory={toggleCategory}
          onReset={() => setActiveCategories(new Set())}
          statuses={statuses}
        />

        {/* React Flow 캔버스 */}
        <div className="relative">
          <ReactFlow
            nodes={nodes} edges={pipelineEdges}
            onNodesChange={onNodesChange} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes} nodesDraggable={false}
            fitView minZoom={0.3} maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Controls position="bottom-left"
              className="!border-0 !shadow-lg [&>button]:!border-0 [&>button]:!text-gray-300 [&>button:hover]:!bg-[#383E47]"
              style={{ backgroundColor: '#252A31', borderColor: '#404854' }} />
            <MiniMap position="bottom-right"
              nodeColor={(node) => {
                if (node.type === 'departmentZone' || node.type === 'agentAvatar') {
                  return (node.data as Record<string, unknown>).color as string ?? '#738091'
                }
                return '#404854'
              }}
              maskColor="rgba(17,20,24,0.8)"
              style={{ backgroundColor: '#1C2127', borderColor: '#404854' }} />
            <Background variant={BackgroundVariant.Dots} color={JARVIS.borderActive} gap={28} size={1.2} style={{ backgroundColor: JARVIS.bg, opacity: 0.6 }} />
            {/* JARVIS 스캔 라인 오버레이 */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
              <div
                className="absolute left-0 right-0 h-px animate-jarvis-scan"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${JARVIS.primary}aa 50%, transparent 100%)`,
                  boxShadow: `0 0 8px ${JARVIS.primary}`,
                }}
              />
            </div>
          </ReactFlow>
        </div>

        <OfficeInsightPanel
          agents={agents} pipelines={pipelines}
          selectedAgent={selectedAgent} onDeselectAgent={() => setSelectedAgent(null)}
          recentEvents={recentEvents} recentTools={recentTools}
        />
      </div>
    </div>
  )
}
