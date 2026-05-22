import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTokenFlow } from '../../lib/hooks/use-token-flow'
import { useCountUp } from '../../lib/hooks/use-count-up'
import { useGlobalTokenStats } from '../../lib/hooks/use-global-token-stats'

// 토큰/비용 미니 위젯 — agor(1210★) per-prompt token + dollar accounting 영감
// 세션 sparkline(순수 SVG) + 최근 14일 일자별 추이(recharts BarChart) 결합
// DOM 노드 적정 유지, 별도 polling 없음 (SessionEventsProvider push + ccusage 5분 캐시)

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

// MM-DD 라벨 — 'YYYY-MM-DD' → 'MM-DD'
function shortDate(period: string): string {
  const parts = period.split('-')
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : period
}

type DailyChartPoint = {
  period: string
  label: string
  tokens: number
  cost: number
}

// 최근 14일 일자별 토큰 추이 — recharts BarChart (Palantir 블루 #2D72D2)
const DailyTrend = memo(function DailyTrend({
  data,
  loading
}: {
  data: DailyChartPoint[]
  loading: boolean
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-[100px] rounded text-xs"
        style={{ color: '#5F6B7C', backgroundColor: 'rgba(64, 72, 84, 0.2)' }}
      >
        {loading ? '일자별 사용 데이터 로딩 중…' : '일자별 토큰 사용 기록이 없습니다'}
      </div>
    )
  }

  // 오늘(마지막 막대)은 더 밝게 강조
  const lastIdx = data.length - 1

  return (
    <div className="h-[100px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#738091', fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: '#404854' }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tick={{ fill: '#738091', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={32}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(45, 114, 210, 0.12)' }}
            contentStyle={{
              backgroundColor: '#252A31',
              border: '1px solid #404854',
              borderRadius: 8,
              fontSize: 12
            }}
            labelStyle={{ color: '#ABB3BF' }}
            itemStyle={{ color: '#F6F7F9' }}
            formatter={(value: number, name: string) =>
              name === 'cost'
                ? [formatUsd(value), '비용']
                : [`${formatNumber(value)} tok`, '토큰']
            }
            labelFormatter={(label: string) => label}
          />
          <Bar dataKey="tokens" radius={[2, 2, 0, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={d.period} fill={i === lastIdx ? '#8ABBFF' : '#2D72D2'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})

export const TokenFlowMini = memo(function TokenFlowMini() {
  const { totalInputTokens, totalOutputTokens, totalCostUsd, recentSamples, maxTokens } =
    useTokenFlow()
  const { recentDaily, loading: dailyLoading } = useGlobalTokenStats()

  const animatedCost = useCountUp(Math.round(totalCostUsd * 1000), 1500) / 1000
  const totalTokens = totalInputTokens + totalOutputTokens

  // 14일 추이 차트 데이터 — MM-DD 라벨 부착
  const dailyChartData: DailyChartPoint[] = recentDaily.map((d) => ({
    period: d.period,
    label: shortDate(d.period),
    tokens: d.tokens,
    cost: d.cost
  }))

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
          <h3 className="text-base font-semibold" style={{ color: '#F6F7F9' }}>
            Token Flow
          </h3>
          <p className="text-xs" style={{ color: '#738091' }}>
            세션 토큰 추정 + Sonnet 4 비용 (char/4 휴리스틱)
          </p>
        </div>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
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
          className="text-5xl font-black tabular-nums"
          style={{
            background: 'linear-gradient(135deg, #29A634 0%, #5BC9C5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          {formatUsd(animatedCost)}
        </span>
        <span className="text-sm" style={{ color: '#738091' }}>
          누적 비용 추정
        </span>
      </div>

      {/* 세션 sparkline */}
      <Sparkline samples={recentSamples} maxTokens={maxTokens} />

      {/* 최근 14일 일자별 토큰 추이 */}
      <div className="mt-4">
        <p className="text-sm font-semibold mb-2" style={{ color: '#ABB3BF' }}>
          최근 14일 토큰 추이
        </p>
        <DailyTrend data={dailyChartData} loading={dailyLoading} />
      </div>

      {/* 하단: 입력/출력 분해 */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(45, 114, 210, 0.10)',
            border: '1px solid rgba(45, 114, 210, 0.25)'
          }}
        >
          <span style={{ color: '#2D72D2' }} className="text-base">
            ↓
          </span>
          <div className="flex-1">
            <p className="text-xs" style={{ color: '#738091' }}>
              Input
            </p>
            <p className="text-base font-bold tabular-nums" style={{ color: '#F6F7F9' }}>
              {formatNumber(totalInputTokens)}
            </p>
          </div>
          <span className="text-xs" style={{ color: '#5F6B7C' }}>
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
          <span style={{ color: '#7961DB' }} className="text-base">
            ↑
          </span>
          <div className="flex-1">
            <p className="text-xs" style={{ color: '#738091' }}>
              Output
            </p>
            <p className="text-base font-bold tabular-nums" style={{ color: '#F6F7F9' }}>
              {formatNumber(totalOutputTokens)}
            </p>
          </div>
          <span className="text-xs" style={{ color: '#5F6B7C' }}>
            {formatUsd((totalOutputTokens / 1_000_000) * 15.0)}
          </span>
        </div>
      </div>
    </div>
  )
})
