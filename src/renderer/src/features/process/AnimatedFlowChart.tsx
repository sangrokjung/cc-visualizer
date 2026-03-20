import { useState } from 'react'

const C = {
  bg: '#111418',
  card: '#1C2127',
  cardSub: '#252A31',
  border: '#404854',
  text: '#F6F7F9',
  textSub: '#ABB3BF',
  textWeak: '#738091',
  blue: '#2D72D2',
  green: '#29A634',
  purple: '#7961DB',
  yellow: '#D1980B',
  red: '#DB2C6F',
  cyan: '#00A396'
}

const FLOW_NODES = [
  { id: 'start', label: '요청 수신', type: 'start' as const, color: C.blue },
  { id: 'typo', label: '오타/1줄?', type: 'decision' as const, color: C.green, recipeId: 1 },
  { id: 'bug', label: '버그?', type: 'decision' as const, color: C.red, recipeId: 2 },
  { id: 'feature', label: '기능 추가?', type: 'decision' as const, color: C.blue, recipeId: 4 },
  { id: 'build', label: '빌드 에러?', type: 'decision' as const, color: C.red, recipeId: 9 },
  { id: 'refactor', label: '리팩토링?', type: 'decision' as const, color: C.yellow, recipeId: 15 },
  { id: 'ui', label: 'UI 작업?', type: 'decision' as const, color: C.cyan, recipeId: 13 },
  { id: 'night', label: '야간 자율?', type: 'decision' as const, color: C.purple, recipeId: 7 },
  {
    id: 'domain',
    label: '전문 도메인?',
    type: 'decision' as const,
    color: C.yellow,
    recipeId: undefined
  }
]

const FLOW_RESULTS: { id: string; label: string; parentId: string }[] = [
  { id: 'r-typo', label: '직접수정 → verify → commit', parentId: 'typo' },
  { id: 'r-bug', label: 'debugging → TDD → verify', parentId: 'bug' },
  { id: 'r-feature', label: '규모별 분기 (소/중/대)', parentId: 'feature' },
  { id: 'r-build', label: '/build-fix', parentId: 'build' },
  { id: 'r-refactor', label: '/refactor-clean → verify', parentId: 'refactor' },
  { id: 'r-ui', label: 'brainstorming → design', parentId: 'ui' },
  { id: 'r-night', label: '/plan → /auto-loop', parentId: 'night' },
  { id: 'r-domain', label: '/agent-router (37 에이전트)', parentId: 'domain' }
]

type Props = {
  onNodeClick?: (recipeId: number) => void
}

export function AnimatedFlowChart({ onNodeClick }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
    >
      <h3 className="text-sm font-bold mb-4" style={{ color: C.text }}>
        의사결정 플로차트
      </h3>

      <div className="space-y-2">
        {/* Start node */}
        <div
          className="flex items-center justify-center mb-4"
          style={{ animation: 'fadeInDown 0.3s ease forwards' }}
        >
          <div
            className="px-4 py-2 rounded-full"
            style={{
              backgroundColor: `${C.blue}20`,
              border: `2px solid ${C.blue}`,
              color: C.blue
            }}
          >
            <span className="text-xs font-bold">요청 수신</span>
          </div>
        </div>

        {/* Decision nodes - 세로 스택 */}
        {FLOW_NODES.slice(1).map((node, i) => {
          const result = FLOW_RESULTS.find((r) => r.parentId === node.id)
          const isHovered = hoveredNode === node.id
          const dimmed = hoveredNode !== null && hoveredNode !== node.id

          return (
            <div
              key={node.id}
              className="flex items-center gap-4 transition-all"
              style={{
                opacity: dimmed ? 0.3 : 1,
                animation: `fadeInDown 0.3s ease forwards`,
                animationDelay: `${(i + 1) * 0.08}s`,
                animationFillMode: 'both'
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => node.recipeId && onNodeClick?.(node.recipeId)}
            >
              {/* 연결선 */}
              <div className="w-8 flex flex-col items-center">
                <div className="w-px h-4" style={{ backgroundColor: C.border }} />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isHovered ? node.color : C.border,
                    transition: 'background-color 0.2s'
                  }}
                />
              </div>

              {/* 질문 노드 */}
              <div
                className="shrink-0 w-28 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                style={{
                  backgroundColor: `${node.color}15`,
                  border: `1px solid ${isHovered ? node.color : `${node.color}40`}`,
                  boxShadow: isHovered ? `0 0 15px ${node.color}30` : 'none'
                }}
              >
                <span className="text-[11px] font-medium" style={{ color: node.color }}>
                  {node.label}
                </span>
              </div>

              {/* 화살표 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: C.green }}>
                  Y →
                </span>
              </div>

              {/* 결과 노드 */}
              {result && (
                <div
                  className="flex-1 px-3 py-2 rounded-lg transition-all"
                  style={{
                    backgroundColor: isHovered ? `${node.color}10` : C.cardSub,
                    border: `1px solid ${isHovered ? `${node.color}30` : 'transparent'}`
                  }}
                >
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: isHovered ? node.color : C.textSub }}
                  >
                    {result.label}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CSS 애니메이션 인라인 */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
