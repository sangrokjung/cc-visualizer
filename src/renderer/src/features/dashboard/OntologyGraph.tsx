import { useMemo, useCallback, useEffect } from 'react'
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

import OntologyNodeComponent, { SkillNodeComponent } from './OntologyNode'
import { buildOntologyGraph, PALANTIR_CATEGORY_COLORS } from './ontology-layout'
import type { OntologyNodeData, SystemData } from './ontology-layout'
import systemData from '../../data/system-data.json'

// 커스텀 노드 타입 등록
const nodeTypes = {
  ontologyNode: OntologyNodeComponent,
  skillNode: SkillNodeComponent
}

interface OntologyGraphProps {
  onNodeSelect: (nodeId: string | null) => void
  selectedNodeId: string | null
  activeFilter: string | null
}

export function OntologyGraph({ onNodeSelect, selectedNodeId, activeFilter }: OntologyGraphProps) {
  // 그래프 레이아웃 계산
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildOntologyGraph(systemData as SystemData, activeFilter, selectedNodeId),
    [activeFilter, selectedNodeId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  // 레이아웃/필터/선택 변경 시 동기화
  useEffect(() => {
    setNodes(layoutNodes)
    setEdges(layoutEdges)
  }, [layoutNodes, layoutEdges, setNodes, setEdges])

  // 노드 클릭 → 선택
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeSelect(node.id)
    },
    [onNodeSelect]
  )

  // 캔버스 클릭 → 선택 해제
  const onPaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  // Escape 키 → 선택 해제
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onNodeSelect(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNodeSelect])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.15}
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
          const d = node.data as unknown as OntologyNodeData
          return PALANTIR_CATEGORY_COLORS[d.category] ?? '#404854'
        }}
        maskColor="rgba(0,0,0,0.8)"
        style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
      />
      <Background
        variant={BackgroundVariant.Dots}
        color="#2F343C"
        gap={24}
        style={{ backgroundColor: '#111418' }}
      />
    </ReactFlow>
  )
}
