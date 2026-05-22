import { memo } from 'react'
import { useTokenFlow } from '../../lib/hooks/use-token-flow'
import { useGlobalTokenStats } from '../../lib/hooks/use-global-token-stats'
import { useCountUp } from '../../lib/hooks/use-count-up'
import { JARVIS } from './office-config'

// Claude Code stats 스타일 토큰/비용 HUD
// UIUX 원칙: 정보 계층 명확 + 단일 줄에 한 정보 + 충분한 여백

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
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

// 현재 세션 sparkline
const TokenSparkline = memo(function TokenSparkline({
  samples, maxTokens,
}: { samples: { tokens: number; isInput: boolean }[]; maxTokens: number }) {
  if (samples.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-7 text-[10px] uppercase tracking-widest font-mono rounded-sm"
        style={{ color: JARVIS.textDim, backgroundColor: `${JARVIS.bg}cc` }}
      >
        ⌛ NO ACTIVITY
      </div>
    )
  }
  const barWidth = 100 / Math.max(samples.length, 1)
  const max = maxTokens > 0 ? maxTokens : 1
  return (
    <svg viewBox="0 0 100 28" className="w-full h-7" preserveAspectRatio="none">
      {samples.map((s, i) => {
        const heightPct = (s.tokens / max) * 100
        const color = s.isInput ? JARVIS.primary : JARVIS.gold
        return (
          <rect
            key={i}
            x={i * barWidth + 0.4}
            y={28 - (heightPct * 28) / 100}
            width={barWidth - 0.8}
            height={(heightPct * 28) / 100}
            fill={color}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
})

// 비교 뱃지 — 어제 대비 ▲ N% / ▼ N%
function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const isUp = pct >= 0
  const color = isUp ? JARVIS.accent : JARVIS.emerald
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1 leading-tight"
      style={{ color, border: `1px solid ${color}80`, backgroundColor: `${color}18` }}
    >
      <span>{isUp ? '▲' : '▼'}</span>
      <span>{Math.abs(pct).toFixed(0)}%</span>
    </span>
  )
}

// 표준 stats 행 — 라벨 + 비용 + 토큰 (한 줄, 잘림 없게 grid 사용)
function StatsRow({
  label, cost, tokens, color, delta, hero,
}: {
  label: string
  cost: number
  tokens: number
  color: string
  delta?: number | null
  hero?: boolean // hero는 메가 카운트 (TODAY 전용)
}) {
  const animatedCostMilli = useCountUp(Math.round(cost * 1000), 700)
  const animatedCost = animatedCostMilli / 1000
  return (
    <div
      className={`grid items-center gap-2 px-2.5 ${hero ? 'py-2.5' : 'py-1.5'}`}
      style={{
        gridTemplateColumns: 'auto 1fr auto',
        backgroundColor: `${color}12`,
        border: `1px solid ${color}40`,
      }}
    >
      {/* 라벨 + delta */}
      <div className="flex items-center gap-1.5">
        <span
          className={`uppercase tracking-widest font-bold ${hero ? 'text-[11px]' : 'text-[10px]'}`}
          style={{ color: hero ? color : JARVIS.textDim }}
        >
          {label}
        </span>
        {delta !== undefined && <DeltaBadge pct={delta ?? null} />}
      </div>

      {/* 중앙 (빈 공간 / 토큰) */}
      <div className="flex justify-end">
        <span
          className={`tabular-nums ${hero ? 'text-[11px]' : 'text-[10px]'}`}
          style={{ color: JARVIS.textDim }}
        >
          {formatTokens(tokens)}
        </span>
      </div>

      {/* 우측: 메인 비용 */}
      <span
        className={`tabular-nums font-bold ${hero ? 'text-2xl' : 'text-sm'} leading-none whitespace-nowrap`}
        style={{
          color,
          textShadow: hero ? `0 0 8px ${color}80` : undefined,
          minWidth: hero ? 88 : 60,
          textAlign: 'right',
        }}
      >
        {formatUsd(animatedCost)}
      </span>
    </div>
  )
}

export default memo(function TokenCostPanel() {
  const { totalCostUsd, recentSamples, maxTokens, samples } = useTokenFlow()
  const { today, yesterday, weekly, allTime, todayVsYesterday, loading, error } =
    useGlobalTokenStats()
  const sessionEvents = samples.length

  return (
    <div
      className="relative p-3.5 font-mono"
      style={{
        backgroundColor: `${JARVIS.bg}cc`,
        border: `1px solid ${JARVIS.borderActive}50`,
        boxShadow: `0 0 12px ${JARVIS.primary}10, inset 0 0 16px ${JARVIS.primary}05`,
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
            ◌ SYNC
          </span>
        ) : error ? (
          <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.scarlet }} title={error}>
            ◌ ERR
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.emerald }}>
            ● LIVE
          </span>
        )}
      </div>

      {/* TODAY hero */}
      <StatsRow
        label="TODAY"
        cost={today?.cost ?? 0}
        tokens={today?.tokens ?? 0}
        color={JARVIS.emerald}
        delta={todayVsYesterday}
        hero
      />

      {/* YDAY · 7D — 한 줄당 하나 (잘림 방지) */}
      <div className="flex flex-col gap-1.5 mt-1.5">
        <StatsRow label="YDAY" cost={yesterday?.cost ?? 0} tokens={yesterday?.tokens ?? 0} color={JARVIS.primaryDim} />
        <StatsRow label="7 DAYS" cost={weekly.cost} tokens={weekly.tokens} color={JARVIS.gold} />
        <StatsRow label="ALL" cost={allTime.cost} tokens={allTime.tokens} color={JARVIS.accent} />
      </div>

      {/* SESSION 구분 — 현재 세션 sparkline */}
      <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${JARVIS.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: JARVIS.primary }}>
              ▸ SESSION
            </span>
            <span
              className="text-[9px] tabular-nums px-1 font-bold"
              style={{
                color: sessionEvents > 0 ? JARVIS.emerald : JARVIS.textDim,
                border: `1px solid ${sessionEvents > 0 ? JARVIS.emerald : JARVIS.border}`,
              }}
            >
              {sessionEvents.toString().padStart(3, '0')}
            </span>
          </div>
          <span
            className="text-[11px] font-bold tabular-nums whitespace-nowrap"
            style={{ color: JARVIS.emerald, textShadow: `0 0 4px ${JARVIS.emerald}40` }}
          >
            {formatUsd(totalCostUsd)}
          </span>
        </div>
        <TokenSparkline samples={recentSamples} maxTokens={maxTokens} />
      </div>

      {/* 단가 푸터 (작게) */}
      <div
        className="mt-2 pt-1.5 text-[8px] uppercase tracking-widest flex items-center justify-between"
        style={{ borderTop: `1px dashed ${JARVIS.border}`, color: JARVIS.textDim }}
      >
        <span>Sonnet 4 · ccusage</span>
        <span style={{ color: JARVIS.primary }}>● claude-only</span>
      </div>
    </div>
  )
})
