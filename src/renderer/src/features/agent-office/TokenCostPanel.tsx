import { memo } from 'react'
import { useTokenFlow } from '../../lib/hooks/use-token-flow'
import { useGlobalTokenStats } from '../../lib/hooks/use-global-token-stats'
import { useCountUp } from '../../lib/hooks/use-count-up'
import { JARVIS } from './office-config'

// Claude Code stats처럼 토큰/비용을 HUD 패널로 표시
// 현재 세션 + 오늘/어제/주간 글로벌 stats (ccusage 위임)

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatUsd(n: number): string {
  if (n < 0.001) return '$0.00'
  if (n < 1) return `$${n.toFixed(3)}`
  if (n < 100) return `$${n.toFixed(2)}`
  if (n < 10_000) return `$${n.toFixed(0)}`
  return `$${(n / 1000).toFixed(1)}K`
}

// 미니 SVG sparkline — 현재 세션 토큰 흐름
const TokenSparkline = memo(function TokenSparkline({
  samples,
  maxTokens,
}: {
  samples: { tokens: number; isInput: boolean }[]
  maxTokens: number
}) {
  if (samples.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-8 text-[10px] uppercase tracking-widest font-mono"
        style={{ color: JARVIS.textDim, backgroundColor: `${JARVIS.bg}80` }}
      >
        ⌛ NO SESSION DATA
      </div>
    )
  }

  const barWidth = 100 / Math.max(samples.length, 1)
  const max = maxTokens > 0 ? maxTokens : 1

  return (
    <svg viewBox="0 0 100 32" className="w-full h-8" preserveAspectRatio="none">
      {samples.map((s, i) => {
        const heightPct = (s.tokens / max) * 100
        const color = s.isInput ? JARVIS.primary : JARVIS.gold
        return (
          <rect
            key={i}
            x={i * barWidth + 0.4}
            y={32 - (heightPct * 32) / 100}
            width={barWidth - 0.8}
            height={(heightPct * 32) / 100}
            fill={color}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
})

// 비교 뱃지 — 어제 대비 +N% / -N%
function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const isUp = pct >= 0
  const color = isUp ? JARVIS.accent : JARVIS.emerald
  const arrow = isUp ? '▲' : '▼'
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5"
      style={{
        color,
        border: `1px solid ${color}80`,
        backgroundColor: `${color}15`,
      }}
    >
      <span>{arrow}</span>
      <span>{Math.abs(pct).toFixed(0)}%</span>
    </span>
  )
}

// 일자별 stats 미니 행
function StatsRow({
  label,
  cost,
  tokens,
  color,
  delta,
  large,
}: {
  label: string
  cost: number
  tokens: number
  color: string
  delta?: number | null
  large?: boolean
}) {
  const animatedCostMilli = useCountUp(Math.round(cost * 1000), 800)
  const animatedCost = animatedCostMilli / 1000
  return (
    <div
      className="flex items-center justify-between px-2 py-1.5"
      style={{
        backgroundColor: `${color}10`,
        border: `1px solid ${color}40`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: JARVIS.textDim, minWidth: 48 }}
        >
          {label}
        </span>
        {delta !== undefined && <DeltaBadge pct={delta ?? null} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`tabular-nums font-bold ${large ? 'text-lg' : 'text-sm'} leading-none`}
          style={{ color, textShadow: large ? `0 0 6px ${color}60` : undefined }}
        >
          {formatUsd(animatedCost)}
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: JARVIS.textDim }}>
          {formatTokens(tokens)}
        </span>
      </div>
    </div>
  )
}

// 토큰 통계 — 현재 세션 + 오늘/어제/주간
export default memo(function TokenCostPanel() {
  // 현재 세션 (session_watcher 기반)
  const { totalCostUsd, recentSamples, maxTokens, samples } = useTokenFlow()
  // 글로벌 일자별 (ccusage 위임)
  const { today, yesterday, weekly, allTime, todayVsYesterday, loading } = useGlobalTokenStats()

  const sessionEvents = samples.length

  return (
    <div
      className="relative p-3 font-mono"
      style={{
        backgroundColor: `${JARVIS.bg}80`,
        border: `1px solid ${JARVIS.borderActive}50`,
        boxShadow: `0 0 16px ${JARVIS.primary}10`,
      }}
    >
      {/* HUD 코너 마커 */}
      <span aria-hidden className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2" style={{ borderColor: JARVIS.primary }} />
      <span aria-hidden className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2" style={{ borderColor: JARVIS.primary }} />
      <span aria-hidden className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2" style={{ borderColor: JARVIS.primary }} />
      <span aria-hidden className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2" style={{ borderColor: JARVIS.primary }} />

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.25em]"
          style={{ color: JARVIS.primary, textShadow: `0 0 6px ${JARVIS.primary}60` }}
        >
          ▸ TOKEN ECONOMY
        </h3>
        {loading ? (
          <span className="text-[9px] uppercase tracking-widest animate-pulse" style={{ color: JARVIS.primary }}>
            ◌ SYNC...
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.emerald }}>
            ● LIVE
          </span>
        )}
      </div>

      {/* 오늘 — 메가 카운트 */}
      <StatsRow
        label="TODAY"
        cost={today?.cost ?? 0}
        tokens={today?.tokens ?? 0}
        color={JARVIS.emerald}
        delta={todayVsYesterday}
        large
      />

      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <StatsRow
          label="YDAY"
          cost={yesterday?.cost ?? 0}
          tokens={yesterday?.tokens ?? 0}
          color={JARVIS.primaryDim}
        />
        <StatsRow
          label="7D"
          cost={weekly.cost}
          tokens={weekly.tokens}
          color={JARVIS.gold}
        />
      </div>

      {/* 전체 — 작게 */}
      <div className="mt-1.5">
        <StatsRow
          label="ALL"
          cost={allTime.cost}
          tokens={allTime.tokens}
          color={JARVIS.accent}
        />
      </div>

      {/* 현재 세션 — 구분선 + sparkline */}
      <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${JARVIS.border}` }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: JARVIS.primary }}>
            ▸ SESSION
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
              EVT
            </span>
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: sessionEvents > 0 ? JARVIS.emerald : JARVIS.textDim }}
            >
              {sessionEvents.toString().padStart(3, '0')}
            </span>
            <span className="text-[10px]" style={{ color: JARVIS.textDim }}>·</span>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: JARVIS.emerald, textShadow: `0 0 4px ${JARVIS.emerald}40` }}
            >
              {formatUsd(totalCostUsd)}
            </span>
          </div>
        </div>
        <TokenSparkline samples={recentSamples} maxTokens={maxTokens} />
      </div>
    </div>
  )
})
