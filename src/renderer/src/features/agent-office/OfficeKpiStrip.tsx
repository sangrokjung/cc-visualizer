import { useMemo, memo, useEffect, useState, useRef } from 'react'
import { useCountUp } from '../../lib/hooks/use-count-up'
import { useSessionEventsContext } from '../../lib/SessionEventsProvider'
import { useGlobalTokenStats } from '../../lib/hooks/use-global-token-stats'
import type { AgentStatus } from './office-config'
import { JARVIS } from './office-config'

function formatUsd(n: number): string {
  if (n < 1) return `$${n.toFixed(2)}`
  if (n < 100) return `$${n.toFixed(0)}`
  if (n < 10_000) return `$${n.toFixed(0)}`
  return `$${(n / 1000).toFixed(1)}K`
}

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
  /** agent id → category 매핑. TopDeptCard 부서 집계용 */
  agentCategory?: Map<string, string>
  /** category → label 매핑 (ex: 'development' → '개발') */
  categoryLabels?: Record<string, string>
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

// TOP DEPT 카드 — 활성 에이전트가 가장 많은 부서를 메가로 강조 (게이미피케이션)
// 부모(OfficeKpiStrip)가 이미 계산한 statuses Map을 받음 → 별도 polling 없음
function TopDeptCard({
  topDept,
  topCount,
}: {
  topDept: string | null
  topCount: number
}) {
  if (!topDept || topCount === 0) return null
  return (
    <div
      className="relative flex items-center gap-2 px-3 py-1.5 font-mono"
      style={{
        backgroundColor: `${JARVIS.accent}10`,
        border: `1px solid ${JARVIS.accent}60`,
        boxShadow: `0 0 8px ${JARVIS.accent}25`,
        minWidth: 140,
      }}
    >
      <span aria-hidden className="absolute -top-px -left-px w-1.5 h-1.5 border-t-2 border-l-2" style={{ borderColor: JARVIS.accent }} />
      <span aria-hidden className="absolute -top-px -right-px w-1.5 h-1.5 border-t-2 border-r-2" style={{ borderColor: JARVIS.accent }} />
      <span aria-hidden className="absolute -bottom-px -left-px w-1.5 h-1.5 border-b-2 border-l-2" style={{ borderColor: JARVIS.accent }} />
      <span aria-hidden className="absolute -bottom-px -right-px w-1.5 h-1.5 border-b-2 border-r-2" style={{ borderColor: JARVIS.accent }} />
      <span className="text-base" aria-hidden style={{ color: JARVIS.accent }}>★</span>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: JARVIS.textDim }}>
          TOP DEPT
        </span>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-base font-bold uppercase tracking-wider"
            style={{ color: JARVIS.accent, textShadow: `0 0 6px ${JARVIS.accent}60` }}
          >
            {topDept}
          </span>
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{ color: JARVIS.text }}
          >
            ×{topCount}
          </span>
        </div>
      </div>
    </div>
  )
}

// TODAY 메가 비용 카드 — HUD에 첫 눈에 들어오게
function TodayCostCard() {
  const { today, todayVsYesterday, loading } = useGlobalTokenStats()
  const cost = today?.cost ?? 0
  const animatedCostMilli = useCountUp(Math.round(cost * 1000), 1000)
  const animatedCost = animatedCostMilli / 1000
  const isUp = todayVsYesterday !== null && todayVsYesterday >= 0
  const deltaColor = isUp ? JARVIS.accent : JARVIS.emerald

  return (
    <div
      className="relative flex items-center gap-3 px-3 py-2 font-mono"
      style={{
        backgroundColor: `${JARVIS.emerald}10`,
        border: `1px solid ${JARVIS.emerald}60`,
        boxShadow: `0 0 14px ${JARVIS.emerald}30, inset 0 0 8px ${JARVIS.emerald}10`,
        minWidth: 180,
      }}
    >
      {/* 코너 마커 */}
      <span aria-hidden className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2" style={{ borderColor: JARVIS.emerald }} />
      <span aria-hidden className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2" style={{ borderColor: JARVIS.emerald }} />
      <span aria-hidden className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2" style={{ borderColor: JARVIS.emerald }} />
      <span aria-hidden className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2" style={{ borderColor: JARVIS.emerald }} />

      {/* 코인/달러 아이콘 */}
      <span
        className="text-2xl"
        style={{
          color: JARVIS.emerald,
          filter: `drop-shadow(0 0 4px ${JARVIS.emerald})`,
        }}
        aria-hidden
      >
        ◈
      </span>

      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: JARVIS.textDim }}>
          {loading ? 'SYNCING TODAY…' : "TODAY'S COST"}
        </span>
        <div className="flex items-baseline gap-2">
          <span
            className="text-2xl font-bold tabular-nums leading-none"
            style={{
              color: JARVIS.emerald,
              textShadow: `0 0 10px ${JARVIS.emerald}80`,
            }}
          >
            {formatUsd(animatedCost)}
          </span>
          {todayVsYesterday !== null && (
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: deltaColor }}
            >
              {isUp ? '▲' : '▼'} {Math.abs(todayVsYesterday).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// 활동 트레일 — 최근 5개 tool_use 이벤트를 dot으로 표시 (게임 콤보 트레일)
// 리소스: DOM 5개, push 기반 (polling 0회)
function ActivityTrail() {
  const { events } = useSessionEventsContext()
  // 최근 5개 tool_use만 추출 (다른 이벤트 무시 → DOM 안정)
  const tools = events
    .filter((e) => e.type === 'tool_use')
    .slice(0, 5)

  return (
    <div className="flex items-center gap-1 font-mono">
      <span
        className="text-[9px] uppercase tracking-widest"
        style={{ color: JARVIS.textDim }}
      >
        TRAIL
      </span>
      <div className="flex items-center gap-0.5">
        {tools.length === 0 ? (
          <span className="text-[9px]" style={{ color: JARVIS.textDim }}>—</span>
        ) : (
          tools.map((ev, idx) => {
            // 가장 최근일수록 밝고 큼, 오래된 건 작고 흐림
            const opacity = 1 - idx * 0.18
            const size = 8 - idx * 0.8
            return (
              <span
                key={ev.id}
                className="inline-block rounded-full"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: JARVIS.gold,
                  opacity,
                  boxShadow: idx === 0 ? `0 0 6px ${JARVIS.gold}` : undefined,
                  transition: 'all 300ms ease',
                }}
                title={ev.data.toolName ?? ev.type}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

// 라이브 이벤트 티커 — 최근 이벤트 1개를 흘러가는 텍스트로 표시
// 리소스 안전: 이벤트 push 기반 (polling 0회), 변화 시에만 리렌더
function LiveTicker() {
  const { events } = useSessionEventsContext()
  // 최근 이벤트의 type + tool/agent 추출
  const latest = events[0]
  const prevIdRef = useRef<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    if (latest && latest.id !== prevIdRef.current) {
      prevIdRef.current = latest.id
      setFlashKey((k) => k + 1)
    }
  }, [latest])

  if (!latest) {
    return (
      <span
        className="text-[10px] uppercase tracking-widest font-mono"
        style={{ color: JARVIS.textDim }}
      >
        ⌛ AWAITING TELEMETRY
      </span>
    )
  }

  const label =
    latest.data.toolName ??
    latest.data.hookName ??
    latest.data.agentName ??
    latest.type
  const eventColor =
    latest.type === 'tool_use' ? JARVIS.gold :
    latest.type === 'agent_spawn' ? JARVIS.emerald :
    latest.type === 'user' ? JARVIS.primary :
    latest.type === 'assistant' ? JARVIS.primary :
    JARVIS.textDim

  return (
    <span
      key={flashKey}
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono animate-jarvis-fade-in"
      style={{ color: JARVIS.text }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: eventColor, boxShadow: `0 0 4px ${eventColor}` }}
      />
      <span className="font-bold" style={{ color: eventColor }}>
        {latest.type}
      </span>
      <span style={{ color: JARVIS.textDim }}>·</span>
      <span className="truncate" style={{ maxWidth: 240 }}>
        {label}
      </span>
    </span>
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
  agentCategory,
  categoryLabels,
}: OfficeKpiStripProps) {
  const counts = useMemo(() => {
    const c = { working: 0, recent: 0, idle: 0, offline: 0 }
    for (const s of statuses.values()) {
      if (s in c) c[s]++
    }
    return c
  }, [statuses])

  const totalAgents = counts.working + counts.recent + counts.idle + counts.offline
  const activeCount = counts.working + counts.recent

  // TOP DEPT 계산 — working 상태 에이전트가 가장 많은 부서
  const { topDept, topCount } = useMemo(() => {
    if (!agentCategory || statuses.size === 0) return { topDept: null as string | null, topCount: 0 }
    const deptWorking: Record<string, number> = {}
    for (const [agentId, status] of statuses) {
      if (status !== 'working') continue
      const cat = agentCategory.get(agentId)
      if (!cat) continue
      deptWorking[cat] = (deptWorking[cat] ?? 0) + 1
    }
    let bestDept: string | null = null
    let bestCount = 0
    for (const [dept, n] of Object.entries(deptWorking)) {
      if (n > bestCount) {
        bestCount = n
        bestDept = dept
      }
    }
    const displayLabel = bestDept ? (categoryLabels?.[bestDept]?.replace('부서', '') ?? bestDept) : null
    return { topDept: displayLabel, topCount: bestCount }
  }, [statuses, agentCategory, categoryLabels])

  return (
    <div
      className="relative flex flex-col gap-2 px-5 py-3"
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

      {/* ROW 1 — 시스템 ID + TODAY COST 메가 + LiveTicker */}
      <div className="relative flex items-center gap-3 flex-wrap">
        <SystemStatusLine demoMode={demoMode} />

        <span className="text-base" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

        <TodayCostCard />

        <span className="text-base" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

        <div className="flex-1 min-w-0 max-w-md">
          <LiveTicker />
        </div>
      </div>

      {/* ROW 2 — 활성 메트릭 + TOP DEPT + 트레일 */}
      <div className="relative flex items-center gap-2.5 flex-wrap">
        <ActivityMeter active={activeCount} total={totalAgents} />

        <TopDeptCard topDept={topDept} topCount={topCount} />

        <span className="text-base" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

        <KpiCard label="ACTIVE" value={counts.working} color={JARVIS.emerald} icon="◉" active={counts.working > 0} />
        <KpiCard label="STANDBY" value={counts.recent} color={JARVIS.primary} icon="◐" />
        <KpiCard label="IDLE" value={counts.idle} color={JARVIS.primaryDim} icon="◯" />
        <KpiCard label="OFFLINE" value={counts.offline} color={JARVIS.scarlet} icon="◌" />

        <span className="text-base" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>

        <KpiCard label="LINKS" value={pipelineCount} color={JARVIS.accent} icon="⇉" />
        <KpiCard label="TOOLS" value={toolCount} color={JARVIS.gold} icon="⚙" />

        {/* 활동 트레일 — 최근 5개 tool_use dot (게임 콤보 느낌) */}
        <span className="text-base" style={{ color: JARVIS.borderActive, opacity: 0.6 }}>│</span>
        <ActivityTrail />
      </div>
    </div>
  )
})
