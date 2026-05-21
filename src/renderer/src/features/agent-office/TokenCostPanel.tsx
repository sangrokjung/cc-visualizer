import { memo } from 'react'
import { useTokenFlow } from '../../lib/hooks/use-token-flow'
import { useCountUp } from '../../lib/hooks/use-count-up'
import { JARVIS } from './office-config'

// Claude Code stats처럼 토큰/비용을 HUD 패널로 표시
// agor(1210★) per-prompt accounting + Claude Code /cost 스타일

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatUsd(n: number): string {
  if (n < 0.001) return '$0.00'
  if (n < 1) return `$${n.toFixed(3)}`
  if (n < 100) return `$${n.toFixed(2)}`
  return `$${n.toFixed(0)}`
}

// 미니 SVG sparkline — 최근 20개 토큰 흐름 (Input 파랑 / Output 보라)
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
        className="flex items-center justify-center h-10 rounded text-[10px] uppercase tracking-widest font-mono"
        style={{ color: JARVIS.textDim, backgroundColor: `${JARVIS.bg}80` }}
      >
        ⌛ AWAITING DATA
      </div>
    )
  }

  const barWidth = 100 / Math.max(samples.length, 1)
  const max = maxTokens > 0 ? maxTokens : 1

  return (
    <svg viewBox="0 0 100 40" className="w-full h-10" preserveAspectRatio="none">
      {samples.map((s, i) => {
        const heightPct = (s.tokens / max) * 100
        const color = s.isInput ? JARVIS.primary : JARVIS.gold
        return (
          <rect
            key={i}
            x={i * barWidth + 0.4}
            y={40 - (heightPct * 40) / 100}
            width={barWidth - 0.8}
            height={(heightPct * 40) / 100}
            fill={color}
            opacity={0.85}
          />
        )
      })}
      {/* baseline */}
      <line x1="0" y1="40" x2="100" y2="40" stroke={JARVIS.border} strokeWidth="0.3" />
    </svg>
  )
})

// 토큰 통계 — Claude Code stats처럼 input/output/cost 분해
export default memo(function TokenCostPanel() {
  const { totalInputTokens, totalOutputTokens, totalCostUsd, recentSamples, maxTokens, samples } =
    useTokenFlow()
  const totalTokens = totalInputTokens + totalOutputTokens
  // 메가 카운트는 1000배 곱해서 정수로 — useCountUp이 정수만 받으니까 ($1.234 → 1234)
  const animatedCostMilli = useCountUp(Math.round(totalCostUsd * 1000), 1200)
  const animatedCost = animatedCostMilli / 1000
  const animatedTotalTokens = useCountUp(Math.round(totalTokens / 100), 1000) * 100
  const sessionEvents = samples.length

  return (
    <div
      className="relative p-4 font-mono"
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
          className="text-[11px] font-bold uppercase tracking-[0.3em]"
          style={{ color: JARVIS.primary, textShadow: `0 0 6px ${JARVIS.primary}60` }}
        >
          ▸ TOKEN FLOW · SONNET 4
        </h3>
        <span
          className="text-[10px] uppercase tracking-widest px-1.5 py-0.5"
          style={{
            color: JARVIS.gold,
            border: `1px solid ${JARVIS.gold}50`,
            backgroundColor: `${JARVIS.gold}10`,
          }}
        >
          {sessionEvents.toString().padStart(3, '0')} EVT
        </span>
      </div>

      {/* 메가 비용 카운터 */}
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="text-3xl font-bold tabular-nums leading-none"
          style={{
            color: JARVIS.emerald,
            textShadow: `0 0 10px ${JARVIS.emerald}60`,
          }}
        >
          {formatUsd(animatedCost)}
        </span>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
          USD · est
        </span>
      </div>

      {/* 총 토큰 */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-base font-bold tabular-nums" style={{ color: JARVIS.text }}>
          {formatTokens(animatedTotalTokens)}
        </span>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
          total tokens
        </span>
      </div>

      {/* Sparkline */}
      <TokenSparkline samples={recentSamples} maxTokens={maxTokens} />

      {/* Input/Output 분해 */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div
          className="px-2 py-1.5"
          style={{
            backgroundColor: `${JARVIS.primary}10`,
            border: `1px solid ${JARVIS.primary}40`,
          }}
        >
          <div className="flex items-center gap-1">
            <span style={{ color: JARVIS.primary }} className="text-xs">↓</span>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
              IN
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-sm font-bold tabular-nums" style={{ color: JARVIS.text }}>
              {formatTokens(totalInputTokens)}
            </span>
            <span className="text-[9px] tabular-nums" style={{ color: JARVIS.textDim }}>
              {formatUsd((totalInputTokens / 1_000_000) * 3.0)}
            </span>
          </div>
        </div>
        <div
          className="px-2 py-1.5"
          style={{
            backgroundColor: `${JARVIS.gold}10`,
            border: `1px solid ${JARVIS.gold}40`,
          }}
        >
          <div className="flex items-center gap-1">
            <span style={{ color: JARVIS.gold }} className="text-xs">↑</span>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
              OUT
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-sm font-bold tabular-nums" style={{ color: JARVIS.text }}>
              {formatTokens(totalOutputTokens)}
            </span>
            <span className="text-[9px] tabular-nums" style={{ color: JARVIS.textDim }}>
              {formatUsd((totalOutputTokens / 1_000_000) * 15.0)}
            </span>
          </div>
        </div>
      </div>

      {/* 단가 정보 (Claude Code stats 느낌) */}
      <div
        className="mt-3 pt-2 text-[9px] flex items-center justify-between uppercase tracking-widest"
        style={{ borderTop: `1px solid ${JARVIS.border}`, color: JARVIS.textDim }}
      >
        <span>$3/M in · $15/M out</span>
        <span style={{ color: JARVIS.primary }}>● LIVE</span>
      </div>
    </div>
  )
})
