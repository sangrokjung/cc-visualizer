import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useSystemDataContext } from '../../lib/DataProvider'

// 에이전트 도구 사용 빈도를 가로 바 차트로 시각화
export function ToolUsageChart() {
  const { systemData } = useSystemDataContext()
  // 도구별 사용 횟수 집계
  const toolCounts: Record<string, number> = {}
  for (const agent of systemData.agents) {
    for (const tool of agent.tools) {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1
    }
  }

  // 빈도 순 정렬
  const data = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  return (
    <div style={{ backgroundColor: '#1C2127', borderColor: '#404854' }} className="rounded-xl border p-5">
      <h3 style={{ color: '#F6F7F9' }} className="text-sm font-semibold mb-4">
        에이전트 도구 사용 현황
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <defs>
            <linearGradient id="toolBarGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2D72D2" />
              <stop offset="100%" stopColor="#00A396" />
            </linearGradient>
          </defs>
          <XAxis
            type="number"
            tick={{ fill: '#ABB3BF', fontSize: 11 }}
            axisLine={{ stroke: '#404854' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fill: '#ABB3BF', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1C2127',
              border: '1px solid #404854',
              borderRadius: '8px',
              fontSize: '12px',
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
