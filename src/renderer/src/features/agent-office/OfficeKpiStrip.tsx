import { useMemo, memo, useEffect, useState } from 'react'
import { useCountUp } from '../../lib/hooks/use-count-up'
import type { AgentStatus } from './office-config'
import { JARVIS } from './office-config'

interface KpiCardProps {
  label: string
  value: number
  color: string
  icon: string
  // 강조 (작업 중 등)
  active?: boolean
}

// HUD 스타일 KPI 미니 카드 — 코너 마커 + 모노 폰트
const KpiCard = memo(function KpiCard({ label, value, color, icon, active }: KpiCardProps) {
  const animated = useCountUp(value, 600)

  return (
    <div
      className="relative flex items-center gap-2 px-3 py-1.5 font-mono"
      style={{
        backgroundColor: `${color}0d`,
        border: `1px solid ${active ? color : color + '50'}`,
        boxShadow: active ? `0 0 8px ${color}40, inset 0 0 6px ${color}10` : undefined,
      }}
    >
      {/* HUD 코너 마커 4개 */}
      <span aria-hidden className="absolute -top-px -left-px w-1.5 h-1.5 border-t border-l" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -top-px -right-px w-1.5 h-1.5 border-t border-r" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -bottom-px -left-px w-1.5 h-1.5 border-b border-l" style={{ borderColor: color }} />
      <span aria-hidden className="absolute -bottom-px -right-px w-1.5 h-1.5 border-b border-r" style={{ borderColor: color }} />

      <span className="text-xs" aria-hidden="true" style={{ color }}>
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[9px] leading-tight uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
          {label}
        </span>
        <span className="text-base font-bold tabular-nums" style={{ color }}>
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

// JARVIS 부팅 시퀀스 — 자비스 느낌의 헤더 라인
function SystemStatusLine({ demoMode }: { demoMode: boolean }) {
  // 시계 (HH:MM:SS) — 1초 tick
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('en-US', { hour12: false })

  return (
    <div className="flex items-center gap-2 font-mono">
      {/* 자비스 코어 인디케이터 */}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          backgroundColor: JARVIS.primary,
          boxShadow: `0 0 8px ${JARVIS.primary}`,
        }}
      >
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ backgroundColor: JARVIS.primary }}
        />
      </span>
      <span
        className="text-xs font-bold tracking-[0.25em] animate-jarvis-boot"
        style={{ color: JARVIS.primary, textShadow: `0 0 8px ${JARVIS.primary}80` }}
      >
        J.A.R.V.I.S
      </span>
      <span className="text-[10px]" style={{ color: JARVIS.textDim }}>·</span>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: JARVIS.textDim }}>
        AGENT OFFICE
      </span>
      <span className="text-[10px]" style={{ color: JARVIS.textDim }}>·</span>
      <span className="text-[10px] tabular-nums" style={{ color: JARVIS.text }}>
        {time}
      </span>
      {demoMode && (
        <span
          className="text-[9px] px-2 py-0.5 uppercase tracking-widest font-bold"
          style={{
            color: JARVIS.accent,
            border: `1px solid ${JARVIS.accent}`,
            backgroundColor: `${JARVIS.accent}10`,
          }}
          title="세션 이벤트 수신 대기 중. 상태는 데모용 랜덤입니다."
          data-testid="demo-mode-badge"
        >
          ◢ DEMO ◣
        </span>
      )}
    </div>
  )
}

// 오피스 상단 HUD 스트립
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

  return (
    <div
      className="relative flex items-center gap-3 px-4 py-2.5 flex-wrap"
      style={{
        backgroundColor: JARVIS.bgPanel,
        borderBottom: `1px solid ${JARVIS.borderActive}40`,
        boxShadow: `inset 0 -1px 0 ${JARVIS.borderActive}20`,
      }}
      data-testid="office-kpi-strip"
    >
      {/* 백드롭 그리드 */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `linear-gradient(${JARVIS.borderActive}15 1px, transparent 1px), linear-gradient(90deg, ${JARVIS.borderActive}15 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative">
        <SystemStatusLine demoMode={demoMode} />
      </div>

      <span className="text-[10px] mx-1" style={{ color: JARVIS.borderActive, opacity: 0.5 }}>│</span>

      <div className="relative flex items-center gap-2">
        <KpiCard label="ACTIVE" value={counts.working} color={JARVIS.emerald} icon="◉" active />
        <KpiCard label="STANDBY" value={counts.recent} color={JARVIS.primary} icon="◐" />
        <KpiCard label="IDLE" value={counts.idle} color={JARVIS.primaryDim} icon="◯" />
        <KpiCard label="OFFLINE" value={counts.offline} color={JARVIS.scarlet} icon="◌" />
      </div>

      <span className="text-[10px] mx-1" style={{ color: JARVIS.borderActive, opacity: 0.5 }}>│</span>

      <div className="relative flex items-center gap-2">
        <KpiCard label="LINKS" value={pipelineCount} color={JARVIS.accent} icon="⇉" />
        <KpiCard label="TOOLS" value={toolCount} color={JARVIS.gold} icon="⚙" />
      </div>
    </div>
  )
})
