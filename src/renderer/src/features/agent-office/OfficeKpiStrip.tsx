import { useMemo, memo } from 'react'
import { useCountUp } from '../../lib/hooks/use-count-up'
import type { AgentStatus } from './office-config'
import { STATUS_CONFIG } from './office-config'

interface KpiCardProps {
  label: string
  value: number
  color: string
  icon: string
}

// 개별 KPI 미니 카드
const KpiCard = memo(function KpiCard({ label, value, color, icon }: KpiCardProps) {
  const animated = useCountUp(value, 600)

  return (
    <div
      className="flex items-center gap-2 rounded px-3 py-1.5"
      style={{ backgroundColor: `${color}10`, border: `1px solid ${color}30` }}
    >
      <span className="text-xs" aria-hidden="true">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] leading-tight" style={{ color: '#738091' }}>{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{animated}</span>
      </div>
    </div>
  )
})

interface OfficeKpiStripProps {
  statuses: Map<string, AgentStatus>
  pipelineCount: number
  toolCount: number
  demoMode: boolean
}

// 오피스 상단 KPI 스트립: 에이전트 상태 집계 + 파이프라인/도구 요약
export default memo(function OfficeKpiStrip({
  statuses,
  pipelineCount,
  toolCount,
  demoMode,
}: OfficeKpiStripProps) {
  // 상태별 집계
  const counts = useMemo(() => {
    const c = { working: 0, recent: 0, idle: 0, offline: 0 }
    for (const s of statuses.values()) {
      if (s in c) c[s]++
    }
    return c
  }, [statuses])

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-wrap"
      style={{ backgroundColor: '#1C2127', borderBottom: '1px solid #404854' }}
      data-testid="office-kpi-strip"
    >
      <span className="text-xs mr-1" style={{ color: '#ABB3BF' }}>🏢</span>
      <span className="text-xs font-bold text-white mr-2 pixel-font tracking-wider">AGENT OFFICE</span>

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

      <span className="text-[10px] mr-1" style={{ color: '#5F6B7C' }}>|</span>

      <KpiCard label={STATUS_CONFIG.working.label} value={counts.working} color="#29A634" icon="●" />
      <KpiCard label={STATUS_CONFIG.recent.label} value={counts.recent} color="#D1980B" icon="◐" />
      <KpiCard label={STATUS_CONFIG.idle.label} value={counts.idle} color="#738091" icon="○" />
      <KpiCard label={STATUS_CONFIG.offline.label} value={counts.offline} color="#404854" icon="◌" />

      <span className="text-[10px] mx-1" style={{ color: '#5F6B7C' }}>|</span>

      <KpiCard label="파이프라인" value={pipelineCount} color="#00A396" icon="⇉" />
      <KpiCard label="도구" value={toolCount} color="#2D72D2" icon="⚙" />
    </div>
  )
})
