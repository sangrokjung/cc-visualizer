import { memo, useMemo } from 'react'
import type { AgentNode, AgentCategory } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'
import { DEPT_LABELS, MODEL_CONFIG } from './office-config'
import type { AgentStatus } from './office-config'

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS) as AgentCategory[]

interface OfficeFilterPanelProps {
  agents: AgentNode[]
  activeCategories: Set<AgentCategory>
  onToggleCategory: (cat: AgentCategory) => void
  onReset: () => void
  statuses: Map<string, AgentStatus>
}

export default memo(function OfficeFilterPanel({
  agents,
  activeCategories,
  onToggleCategory,
  onReset,
  statuses,
}: OfficeFilterPanelProps) {
  // 카테고리별 에이전트 수
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of agents) {
      counts[a.category] = (counts[a.category] || 0) + 1
    }
    return counts
  }, [agents])

  // 모델별 에이전트 수
  const modelCounts = useMemo(() => {
    const counts = { opus: 0, sonnet: 0, haiku: 0 }
    for (const a of agents) {
      if (a.model in counts) counts[a.model as keyof typeof counts]++
    }
    return counts
  }, [agents])

  // 상태별 집계
  const statusCounts = useMemo(() => {
    const c = { working: 0, recent: 0, idle: 0, offline: 0 }
    for (const s of statuses.values()) {
      if (s in c) c[s]++
    }
    return c
  }, [statuses])

  return (
    <div
      className="h-full overflow-y-auto flex flex-col"
      style={{ backgroundColor: '#161a22', borderRight: '1px solid #404854' }}
      data-testid="office-filter-panel"
    >
      {/* 카테고리 필터 */}
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#738091' }}>
          부서 필터
        </h3>
        <div className="flex flex-col gap-1">
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeCategories.size === 0 || activeCategories.has(cat)
            const count = categoryCounts[cat] ?? 0
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded transition-colors text-left"
                style={{
                  backgroundColor: isActive ? `${CATEGORY_COLORS[cat]}12` : 'transparent',
                  color: isActive ? CATEGORY_COLORS[cat] : '#738091',
                }}
              >
                <span className="truncate">{DEPT_LABELS[cat]?.replace('부서', '') ?? cat}</span>
                <span className="text-[10px] ml-1 tabular-nums" style={{ color: '#5F6B7C' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        {activeCategories.size > 0 && (
          <button
            onClick={onReset}
            className="text-[10px] mt-2 px-2 py-1 transition-colors w-full text-center rounded"
            style={{ color: '#ABB3BF', backgroundColor: '#252A3120' }}
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 모델별 분포 */}
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#738091' }}>
          모델
        </h3>
        {(Object.keys(MODEL_CONFIG) as Array<keyof typeof MODEL_CONFIG>).map((key) => {
          const cfg = MODEL_CONFIG[key]
          return (
            <div key={key} className="flex items-center gap-2 py-1">
              <span className="text-xs">{cfg.badge}</span>
              <span className="text-[11px] flex-1" style={{ color: '#ABB3BF' }}>{cfg.rank}</span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: cfg.headColor }}>
                {modelCounts[key as keyof typeof modelCounts] ?? 0}
              </span>
            </div>
          )
        })}
      </div>

      {/* 상태 요약 */}
      <div className="p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#738091' }}>
          현재 상태
        </h3>
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="flex justify-between"><span style={{ color: '#29A634' }}>● 작업 중</span><span className="tabular-nums" style={{ color: '#ABB3BF' }}>{statusCounts.working}</span></div>
          <div className="flex justify-between"><span style={{ color: '#D1980B' }}>◐ 방금 활동</span><span className="tabular-nums" style={{ color: '#ABB3BF' }}>{statusCounts.recent}</span></div>
          <div className="flex justify-between"><span style={{ color: '#738091' }}>○ 대기</span><span className="tabular-nums" style={{ color: '#ABB3BF' }}>{statusCounts.idle}</span></div>
          <div className="flex justify-between"><span style={{ color: '#404854' }}>◌ 오프라인</span><span className="tabular-nums" style={{ color: '#ABB3BF' }}>{statusCounts.offline}</span></div>
        </div>
      </div>
    </div>
  )
})
