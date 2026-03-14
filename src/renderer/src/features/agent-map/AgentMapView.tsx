import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { AgentNode as AgentNodeData, AgentCategory } from '../../lib/types'
import { useSystemData } from '../../lib/use-system-data'
import AgentNodeComponent from './AgentNode'
import AgentDetailPanel from './AgentDetailPanel'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  computeLayout,
  filterByCategory
} from './use-agent-graph'

const nodeTypes = { agentNode: AgentNodeComponent }

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS) as AgentCategory[]

export default function AgentMapView() {
  const { agents, pipelines, loading } = useSystemData()
  const [activeCategories, setActiveCategories] = useState<Set<AgentCategory>>(
    new Set()
  )
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(null)

  const { filteredAgents, filteredPipelines } = useMemo(
    () => filterByCategory(agents, pipelines, activeCategories),
    [agents, pipelines, activeCategories]
  )

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => computeLayout(filteredAgents, filteredPipelines),
    [filteredAgents, filteredPipelines]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 필터/데이터 변경 시 레이아웃 재계산
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const toggleCategory = useCallback((cat: AgentCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const agent = agents.find((a) => a.id === node.id)
    if (agent) setSelectedAgent(agent)
  }, [agents])

  const onPaneClick = useCallback(() => {
    setSelectedAgent(null)
  }, [])

  if (loading && agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ color: '#ABB3BF' }}>
        데이터 로딩 중...
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col">
        {/* 카테고리 필터 툴바 */}
        <div
          className="flex items-center gap-2 px-4 py-2 flex-wrap"
          style={{ backgroundColor: '#1C2127', borderBottom: '1px solid #404854' }}
        >
          <span className="text-xs mr-1" style={{ color: '#738091' }}>필터:</span>
          {ALL_CATEGORIES.map((cat) => {
            const isActive =
              activeCategories.size === 0 || activeCategories.has(cat)
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className="text-[11px] px-2 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: isActive ? CATEGORY_COLORS[cat] : '#404854',
                  backgroundColor: isActive ? `${CATEGORY_COLORS[cat]}15` : 'transparent',
                  color: isActive ? CATEGORY_COLORS[cat] : '#738091'
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            )
          })}
          {activeCategories.size > 0 && (
            <button
              onClick={() => setActiveCategories(new Set())}
              className="text-[11px] px-2 py-1 transition-colors"
              style={{ color: '#738091' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ABB3BF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#738091'}
            >
              초기화
            </button>
          )}
          <span className="ml-auto text-[11px]" style={{ color: '#5F6B7C' }}>
            {filteredAgents.length}개 에이전트 / {filteredPipelines.length}개 연결
          </span>
        </div>

        {/* React Flow 캔버스 */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2}
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
                const agent = node.data as unknown as AgentNodeData
                return CATEGORY_COLORS[agent.category] ?? '#738091'
              }}
              maskColor="rgba(17,20,24,0.8)"
              style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
            />
            <Background variant={BackgroundVariant.Dots} color="#2F343C" gap={24} style={{ backgroundColor: '#111418' }} />
          </ReactFlow>
        </div>
      </div>

      {/* 상세 패널 */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          pipelines={pipelines}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  )
}
