import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
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
import { useAgentStatuses } from './use-agent-status'
import { useOfficeLayout } from './use-office-layout'
import { usePipelineEdges } from './use-pipeline-edges'
import { DEPT_LABELS } from './office-config'
import DepartmentZoneNode from './nodes/DepartmentZoneNode'
import AgentAvatarNode from './nodes/AgentAvatarNode'
import FurnitureNode from './nodes/FurnitureNode'
import AgentProfilePanel from './AgentProfilePanel'

const nodeTypes = {
  departmentZone: DepartmentZoneNode,
  agentAvatar: AgentAvatarNode,
  furniture: FurnitureNode
}

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS) as AgentCategory[]

export default function AgentOfficeView() {
  const { agents, pipelines, loading } = useSystemData()
  const [activeCategories, setActiveCategories] = useState<Set<AgentCategory>>(new Set())
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(null)

  // 에이전트 ID 목록 (안정적 참조)
  const agentIds = useMemo(() => agents.map((a) => a.id), [agents])
  const { statuses, demoMode } = useAgentStatuses(agentIds)

  // 파이프라인 엣지용 레이아웃 노드 ID Set
  const layoutAgentIds = useMemo(() => new Set(agentIds), [agentIds])

  // 레이아웃 계산
  const layoutNodes = useOfficeLayout({
    agents,
    statuses,
    activeCategories,
    pipelines
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)

  // 선택한 에이전트의 in/out 파이프라인 엣지 (선택 없으면 빈 배열)
  const pipelineEdges = usePipelineEdges({
    pipelines,
    selectedAgent,
    layoutAgentIds,
  })

  // 레이아웃 변경 시 노드 업데이트
  useEffect(() => {
    setNodes(layoutNodes)
  }, [layoutNodes, setNodes])

  const toggleCategory = useCallback((cat: AgentCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // 에이전트 노드만 클릭 가능
      if (node.type !== 'agentAvatar') return
      const agent = agents.find((a) => a.id === node.id)
      if (agent) setSelectedAgent(agent)
    },
    [agents]
  )

  const onPaneClick = useCallback(() => {
    setSelectedAgent(null)
  }, [])

  // 통계
  const modelCounts = useMemo(() => {
    const counts = { opus: 0, sonnet: 0, haiku: 0 }
    for (const a of agents) {
      if (a.model in counts) counts[a.model as keyof typeof counts]++
    }
    return counts
  }, [agents])

  // 접근성: 라이브 리전 (상태 변경 요약, 3초 디바운스)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current)
    announceTimerRef.current = setTimeout(() => {
      let working = 0
      let recent = 0
      let idle = 0
      let offline = 0
      for (const s of statuses.values()) {
        if (s === 'working') working++
        else if (s === 'recent') recent++
        else if (s === 'idle') idle++
        else offline++
      }
      if (statuses.size > 0) {
        setLiveAnnouncement(
          `에이전트 현황: ${working}명 작업 중, ${recent}명 방금 활동, ${idle}명 대기, ${offline}명 오프라인`
        )
      }
    }, 3000)
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current)
    }
  }, [statuses])

  if (loading && agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ color: '#ABB3BF' }}>
        데이터 로딩 중...
      </div>
    )
  }

  if (!loading && agents.length === 0) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-3 p-6"
        style={{ backgroundColor: '#0d0f14', color: '#C5CBD3' }}
        data-testid="agent-office-empty"
      >
        <span className="text-4xl" aria-hidden="true">🏢</span>
        <p className="text-sm text-center">
          에이전트를 찾지 못했습니다.
        </p>
        <p className="text-xs text-center" style={{ color: '#ABB3BF' }}>
          ~/.claude/agents 디렉토리에 .md 파일을 추가하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* 접근성: 라이브 리전 */}
      <div
        aria-live="polite"
        className="sr-only"
        data-testid="office-live-region"
      >
        {liveAnnouncement}
      </div>

      <div className="flex-1 flex flex-col">
        {/* 필터 툴바 */}
        <div
          className="flex items-center gap-2 px-4 py-2 flex-wrap"
          style={{ backgroundColor: '#1C2127', borderBottom: '1px solid #404854' }}
        >
          <span className="text-xs mr-1" style={{ color: '#ABB3BF' }}>🏢</span>
          <span className="text-xs font-bold text-white mr-2 pixel-font tracking-wider">AGENT OFFICE</span>

          {/* DEMO MODE 뱃지 — 세션 이벤트 수신 대기 중 */}
          {demoMode && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded mr-2"
              style={{
                backgroundColor: '#fbbf2420',
                color: '#fbbf24',
                border: '1px solid #fbbf2480',
              }}
              title="세션 이벤트 수신 대기 중. 상태는 데모용 랜덤입니다."
              data-testid="demo-mode-badge"
            >
              DEMO MODE
            </span>
          )}

          {/* 모델 카운트 */}
          <span className="text-[10px] text-purple-400 mr-0.5">👑 {modelCounts.opus}</span>
          <span className="text-[10px] text-blue-400 mr-0.5">🎯 {modelCounts.sonnet}</span>
          <span className="text-[10px] text-green-400 mr-2">🌱 {modelCounts.haiku}</span>

          <span className="text-[10px] mr-1" style={{ color: '#5F6B7C' }}>|</span>

          {/* 카테고리 필터 */}
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeCategories.size === 0 || activeCategories.has(cat)
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className="text-[11px] px-2 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: isActive ? CATEGORY_COLORS[cat] : '#404854',
                  backgroundColor: isActive ? `${CATEGORY_COLORS[cat]}15` : 'transparent',
                  color: isActive ? CATEGORY_COLORS[cat] : '#ABB3BF'
                }}
              >
                {(DEPT_LABELS[cat] ?? cat).replace('부서', '')}
              </button>
            )
          })}

          {activeCategories.size > 0 && (
            <button
              onClick={() => setActiveCategories(new Set())}
              className="text-[11px] px-2 py-1 transition-colors"
              style={{ color: '#ABB3BF' }}
            >
              초기화
            </button>
          )}

          <span className="ml-auto text-[11px]" style={{ color: '#ABB3BF' }}>
            {agents.length}명 / {pipelines.length}개 파이프라인
          </span>
        </div>

        {/* React Flow 캔버스 */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={pipelineEdges}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            fitView
            minZoom={0.3}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Controls
              position="bottom-left"
              className="!border-0 !shadow-lg [&>button]:!border-0 [&>button]:!text-gray-300 [&>button:hover]:!bg-[#383E47]"
              style={{ backgroundColor: '#252A31', borderColor: '#404854' }}
            />
            <MiniMap
              position="bottom-right"
              nodeColor={(node) => {
                if (node.type === 'departmentZone') {
                  const d = node.data as Record<string, unknown>
                  return (d.color as string) ?? '#738091'
                }
                if (node.type === 'agentAvatar') {
                  const d = node.data as Record<string, unknown>
                  return (d.color as string) ?? '#738091'
                }
                return '#404854'
              }}
              maskColor="rgba(17,20,24,0.8)"
              style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
            />
            <Background
              variant={BackgroundVariant.Cross}
              color="#1a1e28"
              gap={16}
              size={1}
              style={{ backgroundColor: '#0d0f14' }}
            />
          </ReactFlow>
        </div>
      </div>

      {/* 우측 상세 패널 */}
      {selectedAgent && (
        <AgentProfilePanel
          agent={selectedAgent}
          pipelines={pipelines}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  )
}