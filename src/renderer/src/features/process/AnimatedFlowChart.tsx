import { useState, useCallback } from 'react'

const NODES = [
  // 시작
  { id: 'start', label: '요청 수신', x: 60, y: 20, w: 100, h: 30, type: 'start' as const, color: '#2D72D2' },
  // 의사결정 체인
  { id: 'typo', label: '오타/1줄?', x: 60, y: 80, w: 100, h: 30, type: 'decision' as const, color: '#29A634', recipeId: 1 },
  { id: 'bug', label: '버그?', x: 60, y: 140, w: 100, h: 30, type: 'decision' as const, color: '#DB2C6F', recipeId: 2 },
  { id: 'feature', label: '기능 추가?', x: 60, y: 200, w: 100, h: 30, type: 'decision' as const, color: '#2D72D2', recipeId: 4 },
  { id: 'build', label: '빌드 에러?', x: 60, y: 260, w: 100, h: 30, type: 'decision' as const, color: '#DB2C6F', recipeId: 9 },
  { id: 'refactor', label: '리팩토링?', x: 60, y: 320, w: 100, h: 30, type: 'decision' as const, color: '#D1980B', recipeId: 15 },
  { id: 'ui', label: 'UI 작업?', x: 60, y: 380, w: 100, h: 30, type: 'decision' as const, color: '#00A396', recipeId: 13 },
  { id: 'night', label: '야간 자율?', x: 60, y: 440, w: 100, h: 30, type: 'decision' as const, color: '#7961DB', recipeId: 7 },
  // 결과
  { id: 'r-typo', label: '직접수정 → verify → commit', x: 250, y: 80, w: 220, h: 26, type: 'result' as const, color: '#29A634' },
  { id: 'r-bug', label: 'debugging → TDD → verify', x: 250, y: 140, w: 220, h: 26, type: 'result' as const, color: '#DB2C6F' },
  { id: 'r-feature', label: '규모별 분기 (소/중/대)', x: 250, y: 200, w: 220, h: 26, type: 'result' as const, color: '#2D72D2' },
  { id: 'r-build', label: '/build-fix → debugging', x: 250, y: 260, w: 220, h: 26, type: 'result' as const, color: '#DB2C6F' },
  { id: 'r-refactor', label: '/refactor-clean → verify', x: 250, y: 320, w: 220, h: 26, type: 'result' as const, color: '#D1980B' },
  { id: 'r-ui', label: 'brainstorm → design → checklist', x: 250, y: 380, w: 220, h: 26, type: 'result' as const, color: '#00A396' },
  { id: 'r-night', label: '/plan → /auto-loop', x: 250, y: 440, w: 220, h: 26, type: 'result' as const, color: '#7961DB' },
] as const

const EDGES = [
  // 메인 체인 (세로)
  { from: 'start', to: 'typo', label: undefined },
  { from: 'typo', to: 'bug', label: 'N' },
  { from: 'bug', to: 'feature', label: 'N' },
  { from: 'feature', to: 'build', label: 'N' },
  { from: 'build', to: 'refactor', label: 'N' },
  { from: 'refactor', to: 'ui', label: 'N' },
  { from: 'ui', to: 'night', label: 'N' },
  // 분기 (가로)
  { from: 'typo', to: 'r-typo', label: 'Y' },
  { from: 'bug', to: 'r-bug', label: 'Y' },
  { from: 'feature', to: 'r-feature', label: 'Y' },
  { from: 'build', to: 'r-build', label: 'Y' },
  { from: 'refactor', to: 'r-refactor', label: 'Y' },
  { from: 'ui', to: 'r-ui', label: 'Y' },
  { from: 'night', to: 'r-night', label: 'Y' },
] as const

function isRelatedNode(hovered: string, nodeId: string): boolean {
  if (hovered === nodeId) return true
  if (hovered.startsWith('r-')) return nodeId === hovered.replace('r-', '')
  return nodeId === `r-${hovered}` || nodeId === hovered
}

function isRelatedEdge(hovered: string, edge: { from: string; to: string }): boolean {
  return edge.from === hovered || edge.to === hovered ||
    edge.from === `r-${hovered}` || edge.to === `r-${hovered}` ||
    (hovered.startsWith('r-') && (edge.from === hovered.replace('r-', '') || edge.to === hovered))
}

type Props = {
  onNodeClick?: (recipeId: number) => void
}

export function AnimatedFlowChart({ onNodeClick }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const findNode = useCallback((id: string) => {
    return NODES.find(n => n.id === id)!
  }, [])

  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: '#1C2127', border: '1px solid #404854' }}
    >
      <h3 className="text-sm font-bold mb-4" style={{ color: '#F6F7F9' }}>
        의사결정 플로차트
      </h3>

      <svg viewBox="0 0 520 500" className="w-full" style={{ maxHeight: 520 }}>
        {/* 화살표 마커 정의 */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="8" markerHeight="8" orient="auto-start-auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#404854" />
          </marker>
          <marker id="arrow-y" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="8" markerHeight="8" orient="auto-start-auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#29A634" />
          </marker>
        </defs>

        {/* 엣지 */}
        {EDGES.map(edge => {
          const from = findNode(edge.from)
          const to = findNode(edge.to)
          const isY = edge.label === 'Y'
          const isHorizontal = from.y === to.y

          const x1 = isHorizontal ? from.x + from.w : from.x + from.w / 2
          const y1 = isHorizontal ? from.y + from.h / 2 : from.y + from.h
          const x2 = isHorizontal ? to.x : to.x + to.w / 2
          const y2 = isHorizontal ? to.y + to.h / 2 : to.y

          const dimmed = hoveredNode !== null && !isRelatedEdge(hoveredNode, edge)

          return (
            <g key={`${edge.from}-${edge.to}`} style={{ opacity: dimmed ? 0.15 : 1, transition: 'opacity 0.2s' }}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isY ? '#29A634' : '#404854'}
                strokeWidth={isY ? 2 : 1.5}
                strokeDasharray={isY ? undefined : '4,3'}
                markerEnd={isY ? 'url(#arrow-y)' : 'url(#arrow)'}
              />
              {edge.label && (
                <text
                  x={(x1 + x2) / 2 + (isHorizontal ? 0 : -10)}
                  y={(y1 + y2) / 2 + (isHorizontal ? -6 : 0)}
                  fill={isY ? '#29A634' : '#DB2C6F'}
                  fontSize={9}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}

        {/* 노드 */}
        {NODES.map((node, i) => {
          const isStart = node.type === 'start'
          const isResult = node.type === 'result'
          const isHovered = hoveredNode === node.id
          const dimmed = hoveredNode !== null && !isRelatedNode(hoveredNode, node.id)
          const recipeId = 'recipeId' in node ? (node as { recipeId?: number }).recipeId : undefined

          return (
            <g key={node.id}
              style={{
                opacity: dimmed ? 0.15 : 1,
                cursor: recipeId ? 'pointer' : 'default',
                transition: 'opacity 0.2s',
                animation: 'fadeIn 0.3s ease forwards',
                animationDelay: `${i * 0.05}s`,
                animationFillMode: 'both',
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => recipeId && onNodeClick?.(recipeId)}
            >
              <rect x={node.x} y={node.y} width={node.w} height={node.h}
                rx={isStart ? 15 : isResult ? 4 : 6}
                fill={isHovered ? `${node.color}25` : isResult ? '#252A31' : `${node.color}12`}
                stroke={isHovered ? node.color : isResult ? 'transparent' : `${node.color}50`}
                strokeWidth={isHovered ? 2 : 1}
                filter={isHovered ? `drop-shadow(0 0 6px ${node.color}40)` : undefined}
              />
              <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 4}
                fill={isHovered ? node.color : isResult ? '#ABB3BF' : node.color}
                fontSize={isResult ? 10 : 11}
                fontWeight={isStart ? 'bold' : isResult ? 'normal' : '500'}
                textAnchor="middle"
                fontFamily={isResult ? 'monospace' : 'inherit'}
              >
                {node.label}
              </text>
            </g>
          )
        })}

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </svg>
    </div>
  )
}
