import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useSystemDataContext } from '../../lib/DataProvider'

// 상위 N개로 제한 (전체 50+ 도구를 한 차트에 넣으면 라벨이 겹친다)
const TOP_N = 15

// 에이전트 도구 사용 빈도를 가로 바 차트로 시각화
export function ToolUsageChart() {
  const { systemData } = useSystemDataContext()

  // 도구별 사용 횟수 집계 — agents 변경 시에만 재계산 (매 렌더 207개 순회 방지)
  const { data, totalToolCount } = useMemo(() => {
    const toolCounts: Record<string, number> = {}
    for (const agent of systemData.agents) {
      for (const tool of agent.tools) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1
      }
    }
    const sorted = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])
    return {
      data: sorted.slice(0, TOP_N).map(([name, count]) => ({ name, count })),
      totalToolCount: sorted.length,
    }
  }, [systemData.agents])

  // 긴 도구명(mcp__supabase_db__execute_sql 등) ellipsis
  const formatTick = (name: string): string => (name.length > 22 ? `${name.slice(0, 21)}…` : name)

  return (
    <div style={{ backgroundColor: '#1C2127', borderColor: '#404854' }} className="rounded-xl border p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 style={{ color: '#F6F7F9' }} className="text-base font-semibold">
          에이전트 도구 사용 현황
        </h3>
        <span className="text-xs" style={{ color: '#738091' }}>
          Top {TOP_N} / {totalToolCount}개 도구
        </span>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="toolBarGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2D72D2" />
              <stop offset="100%" stopColor="#00A396" />
            </linearGradient>
          </defs>
          <XAxis
            type="number"
            tick={{ fill: '#ABB3BF', fontSize: 12 }}
            axisLine={{ stroke: '#404854' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fill: '#ABB3BF', fontSize: 12 }}
            tickFormatter={formatTick}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1C2127',
              border: '1px solid #404854',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#F6F7F9'
            }}
            cursor={{ fill: 'rgba(45,114,210,0.08)' }}
          />
          <Bar
            dataKey="count"
            fill="url(#toolBarGradient)"
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
