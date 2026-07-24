import { useMemo, type ReactNode } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts'
import { useSystemDataContext } from '../../lib/DataProvider'
import { useGlobalTokenStats } from '../../lib/hooks/use-global-token-stats'
import { useUsdKrwRate } from '../../lib/hooks/use-usd-krw-rate'
import { formatKrw } from '../../lib/fx'
import { PROVIDER_COLOR, type ModelUsage, type ProviderUsage } from '../../lib/token-aggregation'

const C = {
  bg: '#111418', card: '#1C2127', cardSub: '#252A31',
  border: '#404854', text: '#F6F7F9', textSub: '#ABB3BF',
  textWeak: '#738091', textDim: '#5F6B7C',
}

const PALETTE = ['#2D72D2', '#7961DB', '#00A396', '#29A634', '#D1980B', '#DB2C6F', '#D33D17', '#147EB3', '#8ABBFF', '#62D96B']

const POS = '#D33D17' // 증가(빨강)
const NEG = '#29A634' // 감소(초록)

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

// 토큰 축약: 1.2M / 340K / 980
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// 비용: $X,XXX.XX (천단위 구분 — 가독성)
function fmtCost(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: C.textWeak }}>{label}</p>
    </div>
  )
}

// 기간별 토큰·비용 카드 — 토큰량(상단) + 비용($) + 원화(₩). 환율은 부모에서 주입.
function PeriodUsageCard({
  label, tokens, costUsd, rate, color, hasData = true, badge,
}: {
  label: string
  tokens: number
  costUsd: number
  rate: number
  color: string
  hasData?: boolean
  badge?: ReactNode
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px]" style={{ color: C.textWeak }}>{label}</p>
        {badge}
      </div>
      {hasData ? (
        <>
          <p className="text-2xl font-bold mt-1" style={{ color }}>{fmtTokens(tokens)}</p>
          <p className="text-[10px] mt-0.5" style={{ color: C.textWeak }}>토큰</p>
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <p className="text-sm font-semibold" style={{ color: C.text }}>{fmtCost(costUsd)}</p>
            <p className="text-xs font-bold" style={{ color: '#D1980B' }}>{formatKrw(costUsd, rate)}</p>
          </div>
        </>
      ) : (
        <p className="text-base font-bold mt-2" style={{ color: C.textDim }}>기록 없음</p>
      )}
    </div>
  )
}

// 정수 점유율(합=100) — largest remainder. 독립 반올림이 101%로 새는 것 방지.
function integerShares(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const floor = raw.map((r) => Math.floor(r))
  let remainder = 100 - floor.reduce((s, v) => s + v, 0)
  // 소수부 큰 순서로 +1 분배
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
  const out = [...floor]
  for (const { i } of order) {
    if (remainder <= 0) break
    out[i] += 1
    remainder--
  }
  return out
}

// 제공자별 칩 — Claude/Codex/Gemini 비용 + 점유율. codex 추적 가시화.
function ProviderChips({ providers, rate }: { providers: ProviderUsage[]; rate: number }) {
  if (providers.length === 0) return null
  const shares = integerShares(providers.map((p) => p.cost))
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {providers.map((p, idx) => {
        const share = shares[idx]
        const color = PROVIDER_COLOR[p.provider] ?? C.textWeak
        return (
          <div
            key={p.provider}
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: C.cardSub, border: `1px solid ${color}40` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold" style={{ color: C.text }}>{p.provider}</span>
            <span className="text-xs font-bold" style={{ color }}>{fmtCost(p.cost)}</span>
            <span className="text-[10px]" style={{ color: C.textWeak }}>{formatKrw(p.cost, rate)}</span>
            <span className="text-[10px] font-mono" style={{ color: C.textDim }}>{share}%</span>
          </div>
        )
      })}
    </div>
  )
}

// 모델별 막대 행 — 라벨 + 제공자색 바(비용 비례) + $/₩ + 토큰. codex 모델도 함께 표시.
function ModelBar({ m, maxCost, rate }: { m: ModelUsage; maxCost: number; rate: number }) {
  const color = PROVIDER_COLOR[m.provider] ?? C.textWeak
  const pct = maxCost > 0 ? Math.max(2, (m.cost / maxCost) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-[120px] shrink-0 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs truncate" style={{ color: C.textSub }} title={m.model}>{m.label}</span>
      </div>
      <div className="flex-1 h-5 rounded" style={{ backgroundColor: C.cardSub }}>
        <div className="h-5 rounded flex items-center" style={{ width: `${pct}%`, backgroundColor: `${color}cc`, minWidth: 2 }} />
      </div>
      <div className="w-[150px] shrink-0 text-right">
        <span className="text-xs font-semibold" style={{ color: C.text }}>{fmtCost(m.cost)}</span>
        <span className="text-[10px] ml-1.5" style={{ color: '#D1980B' }}>{formatKrw(m.cost, rate)}</span>
      </div>
      <div className="w-[60px] shrink-0 text-right text-[10px] font-mono" style={{ color: C.textDim }}>{fmtTokens(m.tokens)}</div>
    </div>
  )
}

export default function UsageView() {
  const { usageData, refreshUsage, loading: refreshing } = useSystemDataContext()
  const { summary, projects, toolUsage, agentSpawns, hookEvents, dailyActivity } = usageData

  // 오늘/이번주/이번달/전체 토큰·비용 (ccusage 기반) — 공유 훅
  const tokenStats = useGlobalTokenStats()
  // USD→KRW 환율 (라이브 + 12h 캐시 + 폴백)
  const fx = useUsdKrwRate()

  const handleRefreshUsage = async () => {
    await refreshUsage()
  }

  // deps에 원본 배열을 명시 — refreshUsage로 usageData가 갱신되면 차트도 재계산된다.
  // (deps []이면 새로고침 후에도 첫 스냅샷에 영원히 고정되는 stale 버그)
  const toolChartData = useMemo(() => toolUsage.slice(0, 15), [toolUsage])
  const projectChartData = useMemo(() => projects.slice(0, 12), [projects])
  const hookChartData = useMemo(() => hookEvents.slice(0, 12), [hookEvents])
  const areaData = useMemo(() => dailyActivity.map((d: { date: string; events: number }) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  })), [dailyActivity])

  // 14일 토큰 추이 (날짜 오름차순) — period(YYYY-MM-DD) → MM-DD
  const tokenTrendData = useMemo(
    () => tokenStats.recentDaily.map((d) => ({ ...d, date: d.period.slice(5) })),
    [tokenStats.recentDaily],
  )

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg }}>
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">

        {/* 히어로 */}
        <div className="rounded-2xl p-6" style={{
          background: 'linear-gradient(135deg, rgba(45,114,210,0.12) 0%, rgba(0,163,150,0.08) 50%, rgba(121,97,219,0.12) 100%)',
          border: '1px solid rgba(45,114,210,0.2)',
        }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.text }}>사용 통계 분석</h1>
              <p className="text-xs mt-1" style={{ color: C.textSub }}>
                Claude Code 전체 세션의 에이전트, 도구, 훅 사용 통계
              </p>
            </div>
            <button
              onClick={handleRefreshUsage}
              disabled={refreshing}
              className="text-[11px] px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: '#252A31', color: refreshing ? '#5F6B7C' : '#ABB3BF', border: '1px solid #404854' }}
            >
              {refreshing ? '스캔 중...' : '⟳ 데이터 새로고침'}
            </button>
          </div>
        </div>

        {/* 토큰·비용 사용량 (ccusage — 오늘/이번주/이번달/누적 + 환율 KRW) */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold" style={{ color: C.text }}>토큰·비용 사용량</h2>
              <span className="text-[10px]" style={{ color: C.textDim }}>
                1 USD = ₩{fx.rate.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
                {fx.source === 'live' ? ' · 실시간' : fx.source === 'cache' ? ' · 캐시' : ' · 기본값'}
              </span>
            </div>
            {tokenStats.loading && (
              <span className="text-[10px]" style={{ color: C.textDim }}>불러오는 중…</span>
            )}
            {tokenStats.error && !tokenStats.loading && (
              <span className="text-[10px]" style={{ color: POS }}>데이터 없음</span>
            )}
          </div>

          {/* 오늘 / 이번 주 / 이번 달 / 전체 누적 — 각 토큰 + $ + ₩ */}
          <div className="grid grid-cols-4 gap-4">
            <PeriodUsageCard
              label="오늘"
              tokens={tokenStats.today?.tokens ?? 0}
              costUsd={tokenStats.today?.cost ?? 0}
              rate={fx.rate}
              color="#2D72D2"
              hasData={!!tokenStats.today}
              badge={tokenStats.todayVsYesterday != null && (
                <span className="text-[10px] font-semibold" style={{ color: tokenStats.todayVsYesterday >= 0 ? POS : NEG }}>
                  {tokenStats.todayVsYesterday >= 0 ? '▲' : '▼'} {Math.abs(tokenStats.todayVsYesterday).toFixed(0)}%
                </span>
              )}
            />
            <PeriodUsageCard
              label="이번 주"
              tokens={tokenStats.thisWeek.tokens}
              costUsd={tokenStats.thisWeek.cost}
              rate={fx.rate}
              color="#7961DB"
            />
            <PeriodUsageCard
              label="이번 달"
              tokens={tokenStats.thisMonth.tokens}
              costUsd={tokenStats.thisMonth.cost}
              rate={fx.rate}
              color="#29A634"
            />
            <PeriodUsageCard
              label={`전체 누적 (${fmt(tokenStats.allTime.days)}일)`}
              tokens={tokenStats.allTime.tokens}
              costUsd={tokenStats.allTime.cost}
              rate={fx.rate}
              color="#D1980B"
            />
          </div>

          {/* 14일 토큰 추이 */}
          <div className="mt-5">
            <h3 className="text-xs font-semibold mb-3" style={{ color: C.textSub }}>최근 14일 토큰 추이</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tokenTrendData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.textWeak, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.textWeak, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTokens(v)} />
                <Tooltip
                  contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
                  formatter={(v: number) => [fmtTokens(v), '토큰']}
                />
                <Bar dataKey="tokens" radius={[4, 4, 0, 0]} fill="#2D72D2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 모델별 사용량 (이번 달) — codex(GPT) 포함 멀티 에이전트 추적 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold" style={{ color: C.text }}>모델별 사용량</h2>
              <span className="text-[10px]" style={{ color: C.textDim }}>이번 달 · Claude + Codex + Gemini 추적</span>
            </div>
            <span className="text-[10px]" style={{ color: C.textWeak }}>{tokenStats.modelBreakdown.length}개 모델</span>
          </div>

          {tokenStats.modelBreakdown.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: C.textDim }}>
              {tokenStats.loading ? '불러오는 중…' : '이번 달 모델 사용 기록 없음'}
            </p>
          ) : (
            <>
              <ProviderChips providers={tokenStats.providerBreakdown} rate={fx.rate} />
              <div className="mt-2">
                {tokenStats.modelBreakdown.slice(0, 10).map((m) => (
                  <ModelBar key={m.model} m={m} maxCost={tokenStats.modelBreakdown[0]?.cost ?? 1} rate={fx.rate} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 요약 카드 4개 */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="총 이벤트" value={fmt(summary.totalEvents)} color="#2D72D2" />
          <StatCard label="총 세션" value={fmt(summary.totalSessions)} color="#7961DB" />
          <StatCard label="프로젝트" value={fmt(summary.totalProjects)} color="#29A634" />
          <StatCard label="에이전트 스폰" value={fmt(agentSpawns.reduce((s: number, a: { count: number }) => s + a.count, 0))} color="#D1980B" />
        </div>

        {/* 도구 사용 + 일별 활동 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 도구 사용 순위 */}
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: C.text }}>도구 사용 순위</h3>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={toolChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: C.textWeak, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fill: C.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {toolChartData.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 일별 활동 */}
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: C.text }}>일별 활동</h3>
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={areaData} margin={{ left: 0, right: 10 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2D72D2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2D72D2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: C.textWeak, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.textWeak, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Area type="monotone" dataKey="events" stroke="#2D72D2" strokeWidth={2} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 프로젝트별 활동 + 훅 이벤트 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 프로젝트별 활동 */}
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: C.text }}>프로젝트별 활동</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: C.textWeak, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: C.textSub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Bar dataKey="events" radius={[0, 4, 4, 0]}>
                  {projectChartData.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 훅 이벤트 분포 */}
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: C.text }}>훅 이벤트 분포</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hookChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: C.textWeak, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis type="category" dataKey="tool" width={120} tick={{ fill: C.textSub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#29A634" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 에이전트 스폰 테이블 */}
        <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: C.text }}>
            에이전트 스폰 ({fmt(agentSpawns.reduce((s: number, a: { count: number }) => s + a.count, 0))})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th className="text-left py-2 px-3" style={{ color: C.textWeak }}>에이전트</th>
                  <th className="text-left py-2 px-3" style={{ color: C.textWeak }}>프로젝트</th>
                  <th className="text-right py-2 px-3" style={{ color: C.textWeak }}>횟수</th>
                </tr>
              </thead>
              <tbody>
                {agentSpawns.slice(0, 20).map((agent: { name: string; project: string; count: number }, i: number) => (
                  <tr key={i} className="transition-colors" style={{ borderBottom: `1px solid ${C.border}22` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cardSub}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="py-2 px-3 font-mono" style={{ color: C.textSub }}>
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                      {agent.name}
                    </td>
                    <td className="py-2 px-3" style={{ color: C.textWeak }}>{agent.project}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: C.text }}>{agent.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 스캔 타임스탬프 */}
        <p className="text-[10px] text-center pb-4" style={{ color: C.textDim }}>
          Last scan: {usageData.scanTimestamp ? new Date(usageData.scanTimestamp).toLocaleString('ko-KR') : '-'}
        </p>
      </div>
    </div>
  )
}
