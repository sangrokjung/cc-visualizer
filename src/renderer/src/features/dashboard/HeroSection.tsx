import { useMemo } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'
import { useCountUp } from '../../lib/hooks/use-count-up'
import { useStatsDiff } from '../../lib/hooks/use-stats-diff'

// 스캔 타임스탬프를 로컬 시간으로 포맷
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 도메인 메타 — 색상/아이콘/라벨을 한 곳에 모아 chip 그리드 구성에 사용
const DOMAIN_META = [
  { key: 'agentCount', label: '에이전트', icon: '◆', color: '#2D72D2' },
  { key: 'skillCount', label: '스킬', icon: '⚙', color: '#D1980B' },
  { key: 'hookCount', label: '훅', icon: '⟁', color: '#29A634' },
  { key: 'ruleCount', label: '규칙', icon: '≡', color: '#7961DB' },
  { key: 'pipelineCount', label: '파이프라인', icon: '⇉', color: '#00A396' },
  { key: 'mcpServerCount', label: 'MCP', icon: '⬡', color: '#D33D17' }
] as const

// 변화 뱃지 — +N (초록) / -N (빨강) / 0 (숨김)
function DiffBadge({ value }: { value: number }) {
  if (value === 0) return null
  const isPositive = value > 0
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
      style={{
        backgroundColor: isPositive ? 'rgba(41, 166, 52, 0.18)' : 'rgba(211, 61, 23, 0.18)',
        color: isPositive ? '#29A634' : '#D33D17'
      }}
    >
      {isPositive ? '+' : ''}
      {value}
    </span>
  )
}

// 도메인 칩 — 큰 카운트 + 라벨 + 변화 뱃지
function DomainChip({
  icon,
  label,
  count,
  color,
  diff
}: {
  icon: string
  label: string
  count: number
  color: string
  diff: number
}) {
  const animated = useCountUp(count, 1200)
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:scale-[1.04]"
      style={{
        backgroundColor: 'rgba(28, 33, 39, 0.6)',
        border: `1px solid ${color}33`,
        boxShadow: `inset 0 0 20px ${color}0F`
      }}
    >
      <span className="text-2xl" style={{ color, filter: `drop-shadow(0 0 6px ${color}88)` }}>
        {icon}
      </span>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: '#F6F7F9' }}
          >
            {animated}
          </span>
          <DiffBadge value={diff} />
        </div>
        <span className="text-[11px]" style={{ color: '#738091' }}>
          {label}
        </span>
      </div>
    </div>
  )
}

export function HeroSection() {
  const { systemData } = useSystemDataContext()
  const { stats, scanTimestamp } = systemData
  const diff = useStatsDiff(stats)

  const totalEntities = useMemo(
    () =>
      stats.agentCount +
      stats.skillCount +
      stats.hookCount +
      stats.ruleCount +
      stats.pipelineCount +
      stats.mcpServerCount,
    [stats]
  )

  const animatedTotal = useCountUp(totalEntities, 1500)

  return (
    <div
      className="relative rounded-2xl p-6 border overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top left, rgba(45,114,210,0.22) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(121,97,219,0.18) 0%, transparent 55%), linear-gradient(135deg, rgba(28,33,39,0.95) 0%, rgba(17,20,24,0.95) 100%)',
        borderColor: 'rgba(45,114,210,0.35)',
        boxShadow: '0 0 40px rgba(45,114,210,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      {/* 배경 그리드 패턴 — 후킹 강화 */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        {/* 좌측: 메가 카운트 + 라이브 상태 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: '#29A634' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: '#29A634' }}
              />
            </span>
            <span
              className="text-[11px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: '#29A634' }}
            >
              Live · System Active
            </span>
            <span className="text-[11px]" style={{ color: '#5F6B7C' }}>
              · 최종 스캔 {formatTimestamp(scanTimestamp)}
            </span>
          </div>

          <h1 className="text-xs uppercase tracking-[0.2em]" style={{ color: '#ABB3BF' }}>
            클로드 코드 시스템 개요
          </h1>

          <div className="flex items-baseline gap-3 mt-1">
            <span
              className="text-7xl font-black tabular-nums leading-none"
              style={{
                background: 'linear-gradient(135deg, #F6F7F9 0%, #8ABBFF 50%, #BFAFFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 40px rgba(138,187,255,0.25)'
              }}
            >
              {animatedTotal}
            </span>
            <div className="flex flex-col">
              <span className="text-sm" style={{ color: '#ABB3BF' }}>
                Total Entities
              </span>
              <DiffBadge value={diff.totalDiff} />
            </div>
          </div>
        </div>

        {/* 우측: 6개 도메인 칩 그리드 */}
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6 gap-2">
          {DOMAIN_META.map((meta) => (
            <DomainChip
              key={meta.key}
              icon={meta.icon}
              label={meta.label}
              count={stats[meta.key]}
              color={meta.color}
              diff={diff[meta.key]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
