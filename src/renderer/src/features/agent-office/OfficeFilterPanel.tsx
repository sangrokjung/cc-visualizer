import { memo, useMemo } from 'react'
import type { AgentNode, AgentCategory } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'
import { DEPT_LABELS, MODEL_CONFIG, JARVIS } from './office-config'
import type { AgentStatus } from './office-config'
import TokenCostPanel from './TokenCostPanel'

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS) as AgentCategory[]

interface OfficeFilterPanelProps {
  agents: AgentNode[]
  activeCategories: Set<AgentCategory>
  onToggleCategory: (cat: AgentCategory) => void
  onReset: () => void
  statuses: Map<string, AgentStatus>
}

// JARVIS 사이드 패널 헤더 — 더 큰 폰트 + 글로우
function HudHeader({ label, color = JARVIS.primary }: { label: string; color?: string }) {
  return (
    <div className="relative px-3 py-1.5 mb-3">
      <span aria-hidden className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: color }} />
      <span aria-hidden className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: color }} />
      <span aria-hidden className="absolute bottom-0 left-0 w-2 h-2 border-b border-l" style={{ borderColor: color }} />
      <span aria-hidden className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: color }} />
      <h3
        className="text-[12px] font-bold uppercase tracking-[0.3em] font-mono text-center"
        style={{ color, textShadow: `0 0 6px ${color}60` }}
      >
        ▸ {label}
      </h3>
    </div>
  )
}

export default memo(function OfficeFilterPanel({
  agents,
  activeCategories,
  onToggleCategory,
  onReset,
  statuses,
}: OfficeFilterPanelProps) {
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of agents) counts[a.category] = (counts[a.category] || 0) + 1
    return counts
  }, [agents])

  const modelCounts = useMemo(() => {
    const counts = { opus: 0, sonnet: 0, haiku: 0 }
    for (const a of agents) {
      if (a.model in counts) counts[a.model as keyof typeof counts]++
    }
    return counts
  }, [agents])

  const statusCounts = useMemo(() => {
    const c = { working: 0, recent: 0, idle: 0, offline: 0 }
    for (const s of statuses.values()) {
      if (s in c) c[s]++
    }
    return c
  }, [statuses])

  return (
    <div
      className="h-full overflow-y-auto flex flex-col font-mono"
      style={{
        backgroundColor: JARVIS.bgPanel,
        borderRight: `1px solid ${JARVIS.borderActive}30`,
      }}
      data-testid="office-filter-panel"
    >
      {/* TOKEN/COST 메가 패널 — Claude Code stats 스타일 (사용자 요청 2026-05-21) */}
      <div className="p-3 border-b" style={{ borderColor: JARVIS.border + '50' }}>
        <TokenCostPanel />
      </div>

      {/* 부서 필터 */}
      <div className="p-3 border-b" style={{ borderColor: JARVIS.border + '50' }}>
        <HudHeader label="DEPT FILTER" />
        <div className="flex flex-col gap-1">
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeCategories.size === 0 || activeCategories.has(cat)
            const count = categoryCounts[cat] ?? 0
            const color = CATEGORY_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className="relative flex items-center justify-between text-[12px] px-2.5 py-2 transition-all text-left"
                style={{
                  backgroundColor: isActive ? `${color}15` : 'transparent',
                  color: isActive ? color : JARVIS.textDim,
                  border: `1px solid ${isActive ? color + '70' : 'transparent'}`,
                  boxShadow: isActive ? `inset 0 0 10px ${color}15` : undefined,
                }}
              >
                <span className="truncate uppercase tracking-widest text-[12px] font-semibold">
                  {DEPT_LABELS[cat]?.replace('부서', '') ?? cat}
                </span>
                <span className="text-[12px] ml-1 tabular-nums font-bold">
                  {count.toString().padStart(2, '0')}
                </span>
              </button>
            )
          })}
        </div>
        {activeCategories.size > 0 && (
          <button
            onClick={onReset}
            className="text-[9px] mt-2 px-2 py-1 transition-colors w-full text-center uppercase tracking-widest"
            style={{
              color: JARVIS.accent,
              backgroundColor: `${JARVIS.accent}10`,
              border: `1px solid ${JARVIS.accent}50`,
            }}
          >
            ◢ Reset ◣
          </button>
        )}
      </div>

      {/* 모델 분포 */}
      <div className="p-3 border-b" style={{ borderColor: JARVIS.border + '50' }}>
        <HudHeader label="MODEL TIER" color={JARVIS.gold} />
        {(Object.keys(MODEL_CONFIG) as Array<keyof typeof MODEL_CONFIG>).map((key) => {
          const cfg = MODEL_CONFIG[key]
          const rankEn = key === 'opus' ? 'CMD' : key === 'sonnet' ? 'OPS' : 'JR'
          return (
            <div key={key} className="flex items-center gap-2 py-1.5">
              <span className="text-base">{cfg.badge}</span>
              <span className="text-[12px] flex-1 uppercase tracking-widest font-semibold" style={{ color: JARVIS.textDim }}>
                {rankEn}
              </span>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: cfg.headColor, textShadow: `0 0 4px ${cfg.headColor}50` }}>
                {(modelCounts[key as keyof typeof modelCounts] ?? 0).toString().padStart(3, '0')}
              </span>
            </div>
          )
        })}
      </div>

      {/* 상태 요약 */}
      <div className="p-3">
        <HudHeader label="STATUS" color={JARVIS.emerald} />
        <div className="flex flex-col gap-1.5 text-[12px]">
          {([
            { color: JARVIS.emerald, icon: '◉', label: 'ACTIVE', value: statusCounts.working },
            { color: JARVIS.primary, icon: '◐', label: 'STANDBY', value: statusCounts.recent },
            { color: JARVIS.primaryDim, icon: '◯', label: 'IDLE', value: statusCounts.idle },
            { color: JARVIS.scarlet, icon: '◌', label: 'OFFLINE', value: statusCounts.offline },
          ] as const).map((row) => (
            <div key={row.label} className="flex justify-between items-center px-2 py-0.5">
              <span style={{ color: row.color }} className="uppercase tracking-widest text-[11px] font-semibold">
                {row.icon} {row.label}
              </span>
              <span className="tabular-nums font-bold text-[14px]" style={{ color: JARVIS.text }}>
                {row.value.toString().padStart(3, '0')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
