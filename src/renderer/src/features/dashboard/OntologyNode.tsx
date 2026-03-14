import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { OntologyNodeData } from './ontology-layout'
import { PALANTIR_CATEGORY_COLORS } from './ontology-layout'

// 모델 뱃지 표시
function modelBadge(model: string): string {
  if (model === 'opus') return '⚡O'
  if (model === 'sonnet') return '♪S'
  return '◌D'
}

// 에이전트 노드 컴포넌트
function OntologyNodeComponent({ data }: NodeProps) {
  const d = data as unknown as OntologyNodeData
  const categoryColor = PALANTIR_CATEGORY_COLORS[d.category] ?? '#404854'
  const isSelected = d.selected

  // 표시할 도구 뱃지 (최대 4개 + 나머지 카운트)
  const visibleTools = d.tools.slice(0, 4)
  const extraCount = d.tools.length - 4

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#404854' }} />
      <div
        className="rounded-md px-3 py-2 min-w-[200px] max-w-[260px] cursor-pointer transition-all duration-150 hover:bg-[#2F343C] hover:scale-[1.02]"
        style={{
          backgroundColor: '#252A31',
          border: `1px solid ${isSelected ? '#4C90F0' : '#404854'}`,
          borderLeft: `3px solid ${categoryColor}`,
          boxShadow: isSelected
            ? '0 0 0 3px rgba(138,187,255,0.4), 0 0 0 1px #8ABBFF'
            : 'none'
        }}
      >
        {/* 상단: 카테고리 dot + 이름 + 모델 뱃지 */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
          <span className="text-xs font-semibold truncate" style={{ color: '#F6F7F9' }}>
            {d.label}
          </span>
          <span
            className="ml-auto text-[9px] flex-shrink-0 px-1 rounded"
            style={{ color: '#ABB3BF', backgroundColor: '#1C2127' }}
          >
            {modelBadge(d.model)}
          </span>
        </div>

        {/* 설명 */}
        <p
          className="text-[10px] mt-1 truncate"
          style={{ color: '#ABB3BF' }}
        >
          {d.description}
        </p>

        {/* 도구 뱃지 */}
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {visibleTools.map((tool) => (
            <span
              key={tool}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#1C2127', color: '#ABB3BF' }}
            >
              {tool}
            </span>
          ))}
          {extraCount > 0 && (
            <span
              className="text-[9px] px-1 py-0.5 rounded"
              style={{ backgroundColor: '#1C2127', color: '#ABB3BF' }}
            >
              +{extraCount}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#404854' }} />
    </>
  )
}

// 스킬 노드 컴포넌트 (다이아몬드 형태)
function SkillNode({ data }: NodeProps) {
  const d = data as unknown as OntologyNodeData
  const isSelected = d.selected

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#404854' }} />
      <div className="flex items-center justify-center w-24 h-12">
        <div
          className="w-10 h-10 flex items-center justify-center rotate-45"
          style={{
            backgroundColor: '#252A31',
            border: `1px solid ${isSelected ? '#4C90F0' : '#404854'}`,
            boxShadow: isSelected
              ? '0 0 0 3px rgba(138,187,255,0.4), 0 0 0 1px #8ABBFF'
              : 'none'
          }}
        >
          <span
            className="-rotate-45 text-[10px] truncate block max-w-[60px] text-center"
            style={{ color: '#ABB3BF' }}
          >
            {d.label}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#404854' }} />
    </>
  )
}

export const SkillNodeComponent = memo(SkillNode)
export default memo(OntologyNodeComponent)
