import { memo } from 'react'
import { useTokenFlow } from '../../lib/hooks/use-token-flow'
import { useCountUp } from '../../lib/hooks/use-count-up'

// 토큰/비용 미니 위젯 — agor(1210★) per-prompt token + dollar accounting 영감
// 리소스 안전: useMemo + 순수 SVG sparkline (recharts 미사용)
// DOM 노드 < 40, 별도 polling 없음 (SessionEventsProvider push)

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatUsd(n: number): string {
  if (n < 0.001) return '$0.00'
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

// 미니 sparkline — 20개 샘플을 SVG bars로
const Sparkline = memo(function Sparkline({
  samples,
  maxTokens
}: {
  samples: { tokens: number; isInput: boolean }[]
  maxTokens: number
}) {
  if (samples.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-12 rounded text-[10px]"
        style={{ color: '#5F6B7C', backgroundColor: 'rgba(64, 72, 84, 0.2)' }}
      >
        세션 시작 시 토큰 흐름 표시
      </div>
    )
  }

  const barWidth = 100 / Math.max(samples.length, 1)
  const max = maxTokens > 0 ? maxTokens : 1

  return (
    <svg viewBox="0 0 100 48" className="w-full h-12" preserveAspectRatio="none">
      {samples.map((s, i) => {
        const heightPct = (s.tokens / max) * 100
        const color = s.isInput ? '#2D72D2' : '#7961DB'
        return (
          <rect
            key={i}
            x={i * barWidth + 0.4}
            y={48 - (heightPct * 48) / 100}
            width={barWidth - 0.8}
            height={(heightPct * 48) / 100}
            fill={color}
            opacity={0.85}
            rx={0.5}
          />
        )
      })}
      {/* baseline */}
      <line x1="0" y1="48" x2="100" y2="48" stroke="#404854" strokeWidth="0.3" />
    </svg>
  )
})

export const TokenFlowMini = memo(function TokenFlowMini() {
  const { totalInputTokens, totalOutputTokens, totalCostUsd, recentSamples, maxTokens } =
    useTokenFlow()

  const animatedCost = useCountUp(Math.round(totalCostUsd * 1000), 1500) / 1000
  const totalTokens = totalInputTokens + totalOutputTokens

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        backgroundColor: '#1C2127',
        borderColor: '#404854',
        background: 'linear-gradient(180deg, #1C2127, #161A20 100%)'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#F6F7F9' }}>
            Token Flow
          </h3>
          <p className="text-[10px]" style={{ color: '#738091' }}>
            세션 토큰 추정 + Sonnet 4 비용 (char/4 휴리스틱)
          </p>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{
            backgroundColor: 'rgba(45, 114, 210, 0.15)',
            color: '#8ABBFF'
          }}
        >
          {formatNumber(totalTokens)} tok
        </span>
      </div>

      {/* 메인: 비용 메가 카운트 */}
      <div className="flex items-baseline gap-3 mb-3">
        <span
          className="text-4xl font-black tabular-nums"
          style={{
            background: 'linear-gradient(135deg, #29A634 0%, #5BC9C5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          {formatUsd(animatedCost)}
        </span>
        <span className="text-xs" style={{ color: '#738091' }}>
          누적 비용 추정
        </span>
      </div>

      {/* sparkline */}
      <Sparkline samples={recentSamples} maxTokens={maxTokens} />

      {/* 하단: 입력/출력 분해 */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(45, 114, 210, 0.10)',
            border: '1px solid rgba(45, 114, 210, 0.25)'
          }}
        >
          <span style={{ color: '#2D72D2' }} className="text-sm">
            ↓
          </span>
          <div className="flex-1">
            <p className="text-[10px]" style={{ color: '#738091' }}>
              Input
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: '#F6F7F9' }}>
              {formatNumber(totalInputTokens)}
            </p>
          </div>
          <span className="text-[10px]" style={{ color: '#5F6B7C' }}>
            {formatUsd((totalInputTokens / 1_000_000) * 3.0)}
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(121, 97, 219, 0.10)',
            border: '1px solid rgba(121, 97, 219, 0.25)'
          }}
        >
          <span style={{ color: '#7961DB' }} className="text-sm">
            ↑
          </span>
          <div className="flex-1">
            <p className="text-[10px]" style={{ color: '#738091' }}>
              Output
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: '#F6F7F9' }}>
              {formatNumber(totalOutputTokens)}
            </p>
          </div>
          <span className="text-[10px]" style={{ color: '#5F6B7C' }}>
            {formatUsd((totalOutputTokens / 1_000_000) * 15.0)}
          </span>
        </div>
      </div>
    </div>
  )
})
