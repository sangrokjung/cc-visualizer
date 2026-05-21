import { useMemo, memo, useEffect, useState } from 'react'
import { useCountUp } from '../../lib/hooks/use-count-up'
import type { AgentStatus } from './office-config'
import { JARVIS } from './office-config'

interface KpiCardProps {
  label: string
  value: number
  color: string
  icon: string
  active?: boolean
}

// HUD KPI 카드 — 큰 카운트 + 명확한 라벨
const KpiCard = memo(function KpiCard({ label, value, color, icon, active }: KpiCardProps) {
  const animated = useCountUp(value, 600)

  return (
    <div
      className="relative flex items-center gap-2.5 px-3 py-2 font-mono"
      style={{
        backgroundColor: `${color}10`,
        border: `1px solid ${active ? color : color + '50'}`,
        boxShadow: active ? `0 0 12px ${color}40, inset 0 0 8px ${color}10` : undefined,
        minWidth: 110,
      }}
    >
      {/* HUD 코너 마커 */}
      <span aria-hidden className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2" style={{ borderColor: color }} />

      <span className="text-base" aria-hidden="true" style={{ color, filter: active ? `drop-shadow(0 0 4px ${color})` : undefined }}>
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[10px] leading-tight uppercase tracking-[0.18em] font-bold" style={{ color: JARVIS.textDim }}>
          {label}
        </span>
        <span
          className="text-2xl font-bold tabular-nums leading-none mt-0.5"
          style={{
            color,
            textShadow: active ? `0 0 8px ${color}80` : undefined,
          }}
        >
          {animated.toString().padStart(3, '0')}
        </span>
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

// 게이미피케이션: 활동 콤보 메가 카운터 (전체 활성 비율)
function ActivityMeter({ active, total }: { active: number; total: number }) {
  const pct = total === 0 ? 0 : (active / total) * 100
  const animatedPct = useCountUp(Math.round(pct), 800)
  const color =
    pct > 60 ? JARVIS.emerald :
    pct > 30 ? JARVIS.primary :
    pct > 0 ? JARVIS.gold :
    JARVIS.scarlet

  return (
    <div className="relative flex items-center gap-3 px-3 py-2 font-mono" style={{ minWidth: 140 }}>
      {/* 코너 마커 */}
      <span aria-hidden className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2" style={{ borderColor: color }} />

      <div className="flex flex-col flex-1">
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: JARVIS.textDim }}>
          UTILIZATION
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color, textShadow: `0 0 8px ${color}80` }}
          >
            {animatedPct}
          </span>
          <span className="text-sm font-bold" style={{ color }}>%</span>
        </div>
        {/* 진행 바 */}
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${color}20` }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// JARVIS 시스템 상태 라인 — 더 크고 강조
function SystemStatusLine({ demoMode }: { demoMode: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('en-US', { hour12: false })
  const date = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="flex items-center gap-3 font-mono">
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: JARVIS.primary, boxShadow: `0 0 10px ${JARVIS.primary}` }}
      >
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ backgroundColor: JARVIS.primary }}
        />
      </span>
      <span
        className="text-lg font-bold tracking-[0.3em] animate-jarvis-boot leading-none"
        style={{ color: JARVIS.primary, textShadow: `0 0 12px ${JARVIS.primary}80` }}
      >
        J.A.R.V.I.S
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: JARVIS.text }}>
          AGENT OFFICE
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: JARVIS.textDim }}>
          {date} · {time}
        </span>
      </div>
      {demoMode && (
        <span
          className="text-[10px] px-2 py-1 uppercase tracking-[0.2em] font-bold"
          style={{
            color: JARVIS.accent,
            border: `1px solid ${JARVIS.accent}`,
            backgroundColor: `${JARVIS.accent}15`,
            boxShadow: `0 0 8px ${JARVIS.accent}40`,
          }}
          title="세션 이벤트 수신 대기 중. 상태는 데모용 랜덤입니다."
          data-testid="demo-mode-badge"
        >
          ◢ DEMO MODE ◣
        </span>
      )}
    </div>
  )
}

export default memo(function OfficeKpiStrip({
  statuses,
  pipelineCount,
  toolCount,
  demoMode,
}: OfficeKpiStripProps) {
  const counts = useMemo(() => {
    const c = { working: 0, recent: 0, idle: 0, offline: 0 }
    for (const s of statuses.values()) {
      if (s in c) c[s]++
    }
    return c
  }, [statuses])

  const totalAgents = counts.working + counts.recent + counts.idle + counts.offline
  // 게이미피케이션: 활성 비율 = (working + recent) / total
  const activeCount = counts.working + counts.recent

  return (
    <div
      className="relative flex items-center gap-3 px-5 py-3 flex-wrap"
      style={{
        backgroundColor: JARVIS.bgPanel,
        borderBottom: `2px solid ${JARVIS.borderActive}50`,
        boxShadow: `inset 0 -2px 0 ${JARVIS.borderActive}30, 0 4px 16px rgba(0, 212, 255, 0.05)`,
      }}
      data-testid="office-kpi-strip"
    >
      {/* 백드롭 그리드 */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `linear-gradient(${JARVIS.borderActive}20 1px, transparent 1px), linear-gradient(90deg, ${JARVIS.borderActive}20 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative">
        <SystemStatusLine demoMode={demoMode} />
      </div>

      <span className="text-base mx-1" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

      <div className="relative">
        <ActivityMeter active={activeCount} total={totalAgents} />
      </div>

      <span className="text-base mx-1" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

      <div className="relative flex items-center gap-2">
        <KpiCard label="ACTIVE" value={counts.working} color={JARVIS.emerald} icon="◉" active={counts.working > 0} />
        <KpiCard label="STANDBY" value={counts.recent} color={JARVIS.primary} icon="◐" />
        <KpiCard label="IDLE" value={counts.idle} color={JARVIS.primaryDim} icon="◯" />
        <KpiCard label="OFFLINE" value={counts.offline} color={JARVIS.scarlet} icon="◌" />
      </div>

      <span className="text-base mx-1" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

      <div className="relative flex items-center gap-2">
        <KpiCard label="LINKS" value={pipelineCount} color={JARVIS.accent} icon="⇉" />
        <KpiCard label="TOOLS" value={toolCount} color={JARVIS.gold} icon="⚙" />
      </div>
    </div>
  )
})
