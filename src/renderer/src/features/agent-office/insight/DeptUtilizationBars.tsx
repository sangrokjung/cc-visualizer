import { useMemo, memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import type { AgentNode, AgentCategory } from '../../../lib/types'
import { CATEGORY_COLORS } from '../../../lib/types'
import { DEPT_LABELS } from '../office-config'

interface Props {
  agents: AgentNode[]
}

// 부서별 에이전트 분포 가로 바차트
export default memo(function DeptUtilizationBars({ agents }: Props) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of agents) {
      counts[a.category] = (counts[a.category] || 0) + 1
    }
    return Object.entries(counts)
      .map(([cat, count]) => ({
        name: DEPT_LABELS[cat as AgentCategory]?.replace('부서', '') ?? cat,
        value: count,
        color: CATEGORY_COLORS[cat as AgentCategory] ?? '#738091',
      }))
      .sort((a, b) => b.value - a.value)
  }, [agents])

  if (data.length === 0) return null

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 52 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: '#ABB3BF' }}
            width={50}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1C2127', border: '1px solid #404854', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#ABB3BF' }}
            formatter={(value: number) => [`${value}명`, '에이전트']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
