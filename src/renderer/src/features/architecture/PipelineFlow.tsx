import { useState, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  MarkerType
} from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'

import systemData from '../../data/system-data.json'
import { CATEGORY_COLORS } from '../../lib/types'
import type { AgentCategory } from '../../lib/types'

// -- 타입 --
type PipelineStep = {
  from: string
  to: string
  condition?: string
  auto?: boolean
}

type Pipeline = {
  name: string
  steps: PipelineStep[]
}

// -- 노드 스타일 헬퍼 --
const agentMap = new Map(
  systemData.agents.map((a) => [a.id, a])
)

function getNodeColor(id: string): string {
  const agent = agentMap.get(id)
  if (agent) {
    return CATEGORY_COLORS[agent.category as AgentCategory] ?? '#6b7280'
  }
  return '#6b7280'
}

function isSkillNode(id: string): boolean {
  return id.startsWith('/') || id.startsWith('pm-') || id.startsWith('biz')
}

// -- dagre 레이아웃 --
const NODE_W = 180
const NODE_H = 60

function buildLayout(pipeline: Pipeline): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 })

  const nodeIds = new Set<string>()
  for (const step of pipeline.steps) {
    if (step.from) nodeIds.add(step.from)
    if (step.to) nodeIds.add(step.to)
  }

  for (const id of nodeIds) {
    g.setNode(id, { width: NODE_W, height: NODE_H })
  }

  for (const step of pipeline.steps) {
    if (step.from && step.to) {
      g.setEdge(step.from, step.to)
    }
  }

  dagre.layout(g)

  const nodes: Node[] = [...nodeIds].map((id) => {
    const pos = g.node(id)
    const skill = isSkillNode(id)
    return {
      id,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: { label: id },
      style: {
        width: NODE_W,
        height: NODE_H,
        background: skill ? '#374151' : `${getNodeColor(id)}20`,
        border: `2px solid ${skill ? '#6b7280' : getNodeColor(id)}`,
        borderRadius: skill ? '4px' : '12px',
        color: '#e5e7eb',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        transform: skill ? 'rotate(0deg)' : undefined,
        clipPath: skill
          ? 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
          : undefined
      }
    }
  })

  const edges: Edge[] = pipeline.steps
    .filter((s) => s.from && s.to)
    .map((step, i) => {
      const hasCondition = !!step.condition
      const isAuto = step.auto !== false

      return {
        id: `e-${step.from}-${step.to}-${i}`,
        source: step.from,
        target: step.to,
        label: step.condition ?? '',
        animated: hasCondition,
        style: {
          stroke: hasCondition ? '#f59e0b' : '#6b7280',
          strokeWidth: isAuto ? 2.5 : 1.5,
          strokeDasharray: hasCondition ? '5 5' : undefined
        },
        labelStyle: { fill: '#d1d5db', fontSize: 10, fontWeight: 400 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: hasCondition ? '#f59e0b' : '#6b7280' }
      }
    })

  return { nodes, edges }
}

// -- 범례 --
function Legend() {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 bg-gray-900/90 border border-gray-700 rounded-lg px-4 py-2 text-[11px] text-gray-400 z-10">
      <span className="flex items-center gap-2">
        <span className="w-6 h-0.5 bg-gray-500 inline-block" style={{ height: '2.5px' }} />
        자동 (auto)
      </span>
      <span className="flex items-center gap-2">
        <span className="w-6 h-0.5 bg-gray-500 inline-block" style={{ height: '1.5px' }} />
        수동
      </span>
      <span className="flex items-center gap-2">
        <span
          className="w-6 inline-block"
          style={{ height: '2px', borderTop: '2px dashed #f59e0b' }}
        />
        조건부
      </span>
    </div>
  )
}

// -- 메인 --
const pipelines = systemData.pipelines as Pipeline[]

export default function PipelineFlow() {
  const [selected, setSelected] = useState(0)
  const pipeline = pipelines[selected]

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildLayout(pipeline),
    [pipeline]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  useMemo(() => {
    setNodes(initNodes)
    setEdges(initEdges)
  }, [initNodes, initEdges, setNodes, setEdges])

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelected(Number(e.target.value))
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* 드롭다운 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800">
        <label htmlFor="pipeline-flow-select" className="text-xs text-gray-500">파이프라인:</label>
        <select
          id="pipeline-flow-select"
          value={selected}
          onChange={handleSelect}
          className="bg-gray-800 text-gray-200 text-xs border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          {pipelines.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-gray-600">
          {pipeline.steps.length}개 스텝
        </span>
      </div>

      {/* React Flow */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls
            position="bottom-left"
            className="!bg-gray-800 !border-gray-700 !shadow-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700"
          />
          <MiniMap
            position="bottom-right"
            maskColor="rgba(0, 0, 0, 0.7)"
            className="!bg-gray-900 !border-gray-700"
          />
          <Background variant={BackgroundVariant.Dots} color="#374151" gap={20} />
        </ReactFlow>
        <Legend />
      </div>
    </div>
  )
}
