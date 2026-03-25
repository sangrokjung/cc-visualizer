import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import systemData from '../../data/system-data.json'

// 팔란티어 다크 테마
const C = {
  bg: '#111418',
  card: '#1C2127',
  cardSub: '#252A31',
  border: '#404854',
  text: '#F6F7F9',
  textSub: '#ABB3BF',
  textWeak: '#738091',
  textDim: '#5F6B7C',
  blue: '#2D72D2',
  green: '#29A634',
  purple: '#7961DB',
  yellow: '#D1980B',
  red: '#DB2C6F',
  cyan: '#00A396'
}

// 에이전트 카테고리 색상 매핑
const CATEGORY_COLORS: Record<string, string> = {
  development: '#3b82f6',
  review: '#6366f1',
  business: '#10b981',
  marketing: '#22c55e',
  creative: '#ec4899',
  research: '#a855f7',
  legal: '#eab308',
  operations: '#f97316'
}

// 파이프라인 카테고리 그룹
const PIPELINE_GROUPS = [
  { key: 'all', label: '전체', color: C.blue },
  { key: 'dev', label: '개발', color: '#3b82f6', names: ['코드리뷰', '검증', '설계/구현'] },
  { key: 'biz', label: '비즈니스', color: '#10b981', names: ['비즈니스', '이메일', '재무/회계', '법무/계약', 'CRM'] },
  { key: 'strategy', label: '전략', color: C.purple, names: ['기획', '정부지원사업', 'SEO/GEO/AEO', '메타'] },
  { key: 'content', label: '콘텐츠', color: C.cyan, names: ['콘텐츠/마케팅'] }
]

// 에이전트 이름→카테고리 맵 구축
const agentCategoryMap: Record<string, string> = {}
for (const agent of (systemData as { agents?: { id: string; category?: string }[] }).agents ?? []) {
  if (agent.category) agentCategoryMap[agent.id] = agent.category
}

// 파이프라인 타입
type PipelineStep = { from: string; to: string; condition?: string; auto?: boolean }
type Pipeline = { name: string; steps: PipelineStep[] }
const pipelines: Pipeline[] = (systemData as { pipelines?: Pipeline[] }).pipelines ?? []

// 파이프라인이 어떤 그룹에 속하는지 판단
function getPipelineGroup(name: string): string {
  for (const g of PIPELINE_GROUPS) {
    if (g.key === 'all') continue
    if (g.names?.some((n) => name.includes(n))) return g.key
  }
  return 'dev'
}

function getPipelineGroupColor(name: string): string {
  const groupKey = getPipelineGroup(name)
  return PIPELINE_GROUPS.find((g) => g.key === groupKey)?.color ?? C.blue
}

// ── 커스텀 노드 타입 ──

type PipelineNodeData = {
  label: string
  nodeType: 'agent' | 'skill' | 'entry'
  category?: string
  isAutoTarget?: boolean
}

// 에이전트 노드
const AgentPipelineNode = memo(({ data, selected }: NodeProps<Node<PipelineNodeData>>) => {
  const catColor = data.category ? CATEGORY_COLORS[data.category] ?? C.textWeak : C.textWeak
  return (
    <div
      className="relative group"
      style={{
        background: C.cardSub,
        border: `1px solid ${selected ? catColor : C.border}`,
        borderRadius: 8,
        padding: '8px 14px',
        minWidth: 120,
        transition: 'all 0.2s',
        boxShadow: selected ? `0 0 16px ${catColor}30` : 'none'
      }}
    >
      {/* 카테고리 색상 좌측 바 */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ backgroundColor: catColor }}
      />
      <Handle type="target" position={Position.Left} style={{ background: catColor, border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: catColor, border: 'none', width: 6, height: 6 }} />
      <div className="flex items-center gap-2 pl-2">
        {data.isAutoTarget && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: C.green }}
          />
        )}
        <span className="text-[11px] font-medium" style={{ color: C.text }}>
          {data.label}
        </span>
      </div>
    </div>
  )
})
AgentPipelineNode.displayName = 'AgentPipelineNode'

// 스킬 노드
const SkillPipelineNode = memo(({ data, selected }: NodeProps<Node<PipelineNodeData>>) => {
  return (
    <div
      style={{
        background: `${C.purple}18`,
        border: `1px solid ${selected ? C.purple : `${C.purple}40`}`,
        borderRadius: 20,
        padding: '6px 14px',
        transition: 'all 0.2s',
        boxShadow: selected ? `0 0 12px ${C.purple}30` : 'none'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: C.purple, border: 'none', width: 5, height: 5 }} />
      <Handle type="source" position={Position.Right} style={{ background: C.purple, border: 'none', width: 5, height: 5 }} />
      <span className="text-[10px] font-mono font-medium" style={{ color: C.purple }}>
        {data.label}
      </span>
    </div>
  )
})
SkillPipelineNode.displayName = 'SkillPipelineNode'

// 진입점 노드
const EntryPipelineNode = memo(({ data }: NodeProps<Node<PipelineNodeData>>) => {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        background: `${C.blue}20`,
        border: `2px solid ${C.blue}`,
        borderRadius: '50%',
        width: 44,
        height: 44,
        boxShadow: `0 0 12px ${C.blue}25`
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: C.blue, border: 'none', width: 6, height: 6 }} />
      <span className="text-[9px] font-bold" style={{ color: C.blue }}>
        {data.label}
      </span>
    </div>
  )
})
EntryPipelineNode.displayName = 'EntryPipelineNode'

const nodeTypes = {
  agentNode: AgentPipelineNode,
  skillNode: SkillPipelineNode,
  entryNode: EntryPipelineNode
}

// ── 커스텀 엣지 ──

type PipelineEdgeData = { condition?: string; isAuto: boolean }

function PipelineCustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style
}: EdgeProps<Edge<PipelineEdgeData>>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 16
  })

  const isAuto = data?.isAuto ?? false
  const condition = data?.condition

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: isAuto ? C.green : C.yellow,
          strokeWidth: isAuto ? 2 : 1.5,
          strokeDasharray: isAuto ? undefined : '6 4',
          opacity: 0.7
        }}
      />
      {/* 자동 연결 시 흐르는 애니메이션 */}
      {isAuto && (
        <path
          d={edgePath}
          fill="none"
          stroke={C.green}
          strokeWidth={2}
          strokeDasharray="8 12"
          style={{
            animation: 'pipelineFlowDash 1.5s linear infinite',
            opacity: 0.9
          }}
        />
      )}
      {/* 조건 라벨 */}
      {condition && (
        <foreignObject
          x={labelX - 60}
          y={labelY - 10}
          width={120}
          height={20}
          style={{ overflow: 'visible' }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              background: C.card,
              border: `1px solid ${C.yellow}40`,
              borderRadius: 4,
              padding: '1px 6px',
              maxWidth: 120
            }}
          >
            <span
              className="text-[8px] truncate"
              style={{ color: C.yellow }}
              title={condition}
            >
              {condition.length > 16 ? condition.slice(0, 16) + '...' : condition}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  )
}

const edgeTypes = { pipelineEdge: PipelineCustomEdge }

// ── dagre 레이아웃 ──

const NODE_SIZES = {
  agent: { w: 160, h: 44 },
  skill: { w: 130, h: 32 },
  entry: { w: 44, h: 44 }
}

// step.from이 빈 문자열이면 entry 노드 ID 반환
function resolveFromId(step: PipelineStep, pipelineName: string): string {
  return step.from === '' || step.from === undefined ? `entry-${pipelineName}` : step.from
}

// 파이프라인 steps에서 고유 노드 맵 추출
function collectNodes(pipeline: Pipeline): Map<string, PipelineNodeData> {
  const nodeMap = new Map<string, PipelineNodeData>()
  const autoTargets = new Set(pipeline.steps.filter((s) => s.auto).map((s) => s.to))

  for (const step of pipeline.steps) {
    const fromId = resolveFromId(step, pipeline.name)
    if (fromId.startsWith('entry') && !nodeMap.has(fromId)) {
      nodeMap.set(fromId, { label: '시작', nodeType: 'entry' })
    }

    for (const name of [step.from || null, step.to]) {
      if (!name || nodeMap.has(name)) continue
      const isSkill = name.startsWith('/')
      nodeMap.set(name, {
        label: name,
        nodeType: isSkill ? 'skill' : 'agent',
        category: isSkill ? undefined : agentCategoryMap[name],
        isAutoTarget: autoTargets.has(name)
      })
    }
  }
  return nodeMap
}

// dagre 레이아웃 적용 후 React Flow 노드/엣지 생성
function buildFlowFromPipeline(pipeline: Pipeline): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = collectNodes(pipeline)

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 140, marginx: 20, marginy: 20 })

  for (const [id, data] of nodeMap) {
    g.setNode(id, { ...NODE_SIZES[data.nodeType] })
  }
  for (const step of pipeline.steps) {
    g.setEdge(resolveFromId(step, pipeline.name), step.to)
  }
  dagre.layout(g)

  const nodes: Node[] = [...nodeMap].map(([id, data]) => {
    const pos = g.node(id)
    const size = NODE_SIZES[data.nodeType]
    return {
      id,
      type: data.nodeType === 'agent' ? 'agentNode' : data.nodeType === 'skill' ? 'skillNode' : 'entryNode',
      position: { x: (pos?.x ?? 0) - size.w / 2, y: (pos?.y ?? 0) - size.h / 2 },
      data
    }
  })

  const edges: Edge[] = pipeline.steps.map((step, i) => ({
    id: `pe-${pipeline.name}-${i}`,
    source: resolveFromId(step, pipeline.name),
    target: step.to,
    type: 'pipelineEdge',
    data: { condition: step.condition, isAuto: step.auto ?? false } as PipelineEdgeData,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: step.auto ? C.green : C.yellow }
  }))

  return { nodes, edges }
}

// ── 메인 컴포넌트 ──

export default function PipelineFlowChart() {
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [selectedPipeline, setSelectedPipeline] = useState<string>(pipelines[2]?.name ?? pipelines[0]?.name ?? '')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // 그룹 필터 적용
  const filteredPipelines = useMemo(() => {
    if (selectedGroup === 'all') return pipelines
    const group = PIPELINE_GROUPS.find((g) => g.key === selectedGroup)
    if (!group?.names) return pipelines
    return pipelines.filter((p) => group.names!.some((n) => p.name.includes(n)))
  }, [selectedGroup])

  // 현재 파이프라인
  const currentPipeline = useMemo(
    () => pipelines.find((p) => p.name === selectedPipeline) ?? pipelines[0],
    [selectedPipeline]
  )

  // Flow 데이터 생성
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!currentPipeline) return { initialNodes: [], initialEdges: [] }
    const { nodes, edges } = buildFlowFromPipeline(currentPipeline)
    return { initialNodes: nodes, initialEdges: edges }
  }, [currentPipeline])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 파이프라인 변경 시 노드/엣지 업데이트
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
  }, [selectedNodeId])

  // 파이프라인 통계
  const stats = useMemo(() => {
    if (!currentPipeline) return { nodes: 0, edges: 0, autoCount: 0, condCount: 0 }
    const steps = currentPipeline.steps
    const uniqueNodes = new Set<string>()
    for (const s of steps) {
      if (s.from) uniqueNodes.add(s.from)
      uniqueNodes.add(s.to)
    }
    return {
      nodes: uniqueNodes.size + (steps.some((s) => !s.from) ? 1 : 0),
      edges: steps.length,
      autoCount: steps.filter((s) => s.auto).length,
      condCount: steps.filter((s) => !s.auto).length
    }
  }, [currentPipeline])

  // 선택된 노드 정보
  const selectedNodeInfo = useMemo(() => {
    if (!selectedNodeId || !currentPipeline) return null
    const inEdges = currentPipeline.steps.filter((s) => s.to === selectedNodeId || ((!s.from) && selectedNodeId.startsWith('entry')))
    const outEdges = currentPipeline.steps.filter((s) => {
      const fromId = !s.from ? `entry-${currentPipeline.name}` : s.from
      return fromId === selectedNodeId
    })
    const category = agentCategoryMap[selectedNodeId]
    return { id: selectedNodeId, inEdges, outEdges, category }
  }, [selectedNodeId, currentPipeline])

  return (
    <div>
      <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
        에이전트 파이프라인 플로우
      </h2>

      {/* 카테고리 탭 + 파이프라인 선택 */}
      <div className="space-y-2 mb-3">
        {/* 그룹 탭 */}
        <div className="flex gap-1.5">
          {PIPELINE_GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => {
                setSelectedGroup(g.key)
                if (g.key !== 'all' && g.names) {
                  const first = pipelines.find((p) => g.names!.some((n) => p.name.includes(n)))
                  if (first) setSelectedPipeline(first.name)
                }
              }}
              className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
              style={{
                borderColor: selectedGroup === g.key ? g.color : C.border,
                backgroundColor: selectedGroup === g.key ? `${g.color}15` : 'transparent',
                color: selectedGroup === g.key ? g.color : C.textWeak
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* 파이프라인 버튼 */}
        <div className="flex flex-wrap gap-1.5">
          {filteredPipelines.map((p) => {
            const pColor = getPipelineGroupColor(p.name)
            const isSelected = selectedPipeline === p.name
            return (
              <button
                key={p.name}
                onClick={() => setSelectedPipeline(p.name)}
                className="text-[10px] px-2 py-0.5 rounded transition-all"
                style={{
                  backgroundColor: isSelected ? `${pColor}20` : C.cardSub,
                  color: isSelected ? pColor : C.textDim,
                  border: `1px solid ${isSelected ? pColor : 'transparent'}`
                }}
              >
                {p.name.replace(' 파이프라인', '')}
                <span className="ml-1 opacity-60">({p.steps.length})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* React Flow 그래프 */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: C.card,
          border: `1px solid ${C.border}`,
          height: 420
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: C.card }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color={`${C.border}60`}
          />
          <Controls
            style={{ background: C.cardSub, border: `1px solid ${C.border}`, borderRadius: 8 }}
            showInteractive={false}
          />
          <MiniMap
            style={{ background: C.cardSub, border: `1px solid ${C.border}`, borderRadius: 8 }}
            nodeColor={(n) => {
              if (n.type === 'entryNode') return C.blue
              if (n.type === 'skillNode') return C.purple
              const cat = (n.data as PipelineNodeData)?.category
              return cat ? CATEGORY_COLORS[cat] ?? C.textWeak : C.textWeak
            }}
            maskColor={`${C.bg}90`}
          />
        </ReactFlow>
      </div>

      {/* 하단 통계 + 노드 상세 */}
      <div className="flex gap-3 mt-3">
        {/* 통계 + 범례 */}
        <div
          className="flex items-center gap-4 px-4 py-2 rounded-lg flex-1"
          style={{ backgroundColor: C.cardSub }}
        >
          <span className="text-[10px]" style={{ color: C.textDim }}>
            노드 <span style={{ color: C.text }}>{stats.nodes}</span>
          </span>
          <span className="text-[10px]" style={{ color: C.textDim }}>
            연결 <span style={{ color: C.text }}>{stats.edges}</span>
          </span>
          <span className="w-px h-3" style={{ backgroundColor: C.border }} />
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: C.green }}>
            <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: C.green }} />
            자동 ({stats.autoCount})
          </span>
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: C.yellow }}>
            <span className="w-4 h-0.5 rounded-full border-dashed border-t" style={{ borderColor: C.yellow }} />
            조건부 ({stats.condCount})
          </span>
        </div>

        {/* 선택 노드 상세 */}
        {selectedNodeInfo && (
          <div
            className="px-4 py-2 rounded-lg"
            style={{ backgroundColor: C.cardSub, minWidth: 240 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold font-mono" style={{ color: C.text }}>
                {selectedNodeInfo.id.startsWith('entry') ? '시작점' : selectedNodeInfo.id}
              </span>
              {selectedNodeInfo.category && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${CATEGORY_COLORS[selectedNodeInfo.category] ?? C.textWeak}20`,
                    color: CATEGORY_COLORS[selectedNodeInfo.category] ?? C.textWeak
                  }}
                >
                  {selectedNodeInfo.category}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {selectedNodeInfo.inEdges.length > 0 && (
                <span className="text-[9px]" style={{ color: C.textDim }}>
                  IN: {selectedNodeInfo.inEdges.length}
                </span>
              )}
              {selectedNodeInfo.outEdges.length > 0 && (
                <span className="text-[9px]" style={{ color: C.textDim }}>
                  OUT: {selectedNodeInfo.outEdges.length}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes pipelineFlowDash {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        .react-flow__controls button {
          background: ${C.cardSub} !important;
          border-color: ${C.border} !important;
          fill: ${C.textSub} !important;
        }
        .react-flow__controls button:hover {
          background: ${C.card} !important;
        }
      `}</style>
    </div>
  )
}
