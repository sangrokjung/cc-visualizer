import { useMemo, useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts'
import { useSystemDataContext } from '../../lib/DataProvider'
import { useGlobalTokenStats } from '../../lib/hooks/use-global-token-stats'

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

// 비용: $X.XX
function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: C.textWeak }}>{label}</p>
    </div>
  )
}

export default function UsageView() {
  const { usageData, refreshUsage, loading: refreshing } = useSystemDataContext()
  const { summary, projects, toolUsage, agentSpawns, hookEvents, dailyActivity } = usageData

  // 오늘/주간/전체 토큰·비용 (ccusage 기반) — 공유 훅
  const tokenStats = useGlobalTokenStats()

  const handleRefreshUsage = async () => {
    await refreshUsage()
  }

  const toolChartData = useMemo(() => toolUsage.slice(0, 15), [])
  const projectChartData = useMemo(() => projects.slice(0, 12), [])
  const hookChartData = useMemo(() => hookEvents.slice(0, 12), [])
  const areaData = useMemo(() => dailyActivity.map((d: any) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  })), [])

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

        {/* 오늘 사용량 (ccusage 토큰·비용) */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: C.text }}>오늘 사용량</h2>
            {tokenStats.loading && (
              <span className="text-[10px]" style={{ color: C.textDim }}>불러오는 중…</span>
            )}
            {tokenStats.error && !tokenStats.loading && (
              <span className="text-[10px]" style={{ color: POS }}>데이터 없음</span>
            )}
          </div>

          {/* 상단: 오늘 토큰/비용(강조) + 주간/전체(보조) */}
          <div className="grid grid-cols-4 gap-4">
            {/* 오늘 토큰 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}>
              <p className="text-[10px] mb-1" style={{ color: C.textWeak }}>오늘 토큰</p>
              {tokenStats.today ? (
                <p className="text-3xl font-bold" style={{ color: '#2D72D2' }}>{fmtTokens(tokenStats.today.tokens)}</p>
              ) : (
                <p className="text-xl font-bold" style={{ color: C.textDim }}>오늘 사용 기록 없음</p>
              )}
            </div>

            {/* 오늘 비용 + 어제 대비 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}>
              <p className="text-[10px] mb-1" style={{ color: C.textWeak }}>오늘 비용</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold" style={{ color: '#00A396' }}>
                  {tokenStats.today ? fmtCost(tokenStats.today.cost) : '$0.00'}
                </p>
                {tokenStats.todayVsYesterday != null && (
                  <span
                    className="text-xs font-semibold mb-1"
                    style={{ color: tokenStats.todayVsYesterday >= 0 ? POS : NEG }}
                  >
                    {tokenStats.todayVsYesterday >= 0 ? '▲' : '▼'} {Math.abs(tokenStats.todayVsYesterday).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-[10px] mt-1" style={{ color: C.textDim }}>어제 대비</p>
            </div>

            {/* 주간 누적 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}>
              <p className="text-[10px] mb-1" style={{ color: C.textWeak }}>최근 7일</p>
              <p className="text-2xl font-bold" style={{ color: '#7961DB' }}>{fmtCost(tokenStats.weekly.cost)}</p>
              <p className="text-[10px] mt-1" style={{ color: C.textDim }}>{fmtTokens(tokenStats.weekly.tokens)} 토큰</p>
            </div>

            {/* 전체 누적 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}>
              <p className="text-[10px] mb-1" style={{ color: C.textWeak }}>전체 누적 ({fmt(tokenStats.allTime.days)}일)</p>
              <p className="text-2xl font-bold" style={{ color: '#D1980B' }}>{fmtCost(tokenStats.allTime.cost)}</p>
              <p className="text-[10px] mt-1" style={{ color: C.textDim }}>{fmtTokens(tokenStats.allTime.tokens)} 토큰</p>
            </div>
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

        {/* 요약 카드 4개 */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="총 이벤트" value={fmt(summary.totalEvents)} color="#2D72D2" />
          <StatCard label="총 세션" value={fmt(summary.totalSessions)} color="#7961DB" />
          <StatCard label="프로젝트" value={fmt(summary.totalProjects)} color="#29A634" />
          <StatCard label="에이전트 스폰" value={fmt(agentSpawns.reduce((s: number, a: any) => s + a.count, 0))} color="#D1980B" />
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
                  {toolChartData.map((_: any, i: number) => (
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
                  {projectChartData.map((_: any, i: number) => (
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
            에이전트 스폰 ({fmt(agentSpawns.reduce((s: number, a: any) => s + a.count, 0))})
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
                {agentSpawns.slice(0, 20).map((agent: any, i: number) => (
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
