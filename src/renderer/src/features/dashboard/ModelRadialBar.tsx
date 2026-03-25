import { useMemo } from 'react'
import {
  RadialBarChart,
  RadialBar,
  Legend,
  ResponsiveContainer
} from 'recharts'
import systemData from '../../data/system-data.json'

export function ModelRadialBar() {
  const { chartData, totalAgents } = useMemo(() => {
    // 모델별 카운트
    const counts: Record<string, number> = {}
    for (const agent of systemData.agents) {
      const model = agent.model || 'default'
      // inherit, 기타 비표준 모델은 default로 통합
      const normalized = ['opus', 'sonnet'].includes(model) ? model : 'default'
      counts[normalized] = (counts[normalized] || 0) + 1
    }

    return {
      chartData: [
        { name: 'Default', value: counts['default'] || 0, fill: '#404854' },
        { name: 'Sonnet', value: counts['sonnet'] || 0, fill: '#2D72D2' },
        { name: 'Opus', value: counts['opus'] || 0, fill: '#7961DB' }
      ],
      totalAgents: systemData.agents.length
    }
  }, [])

  return (
    <div style={{ backgroundColor: '#1C2127', borderColor: '#404854' }} className="rounded-xl border p-5">
      <h3 style={{ color: '#F6F7F9' }} className="text-sm font-semibold mb-3">모델 분포</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadialBarChart
          innerRadius="20%"
          outerRadius="85%"
          barSize={20}
          data={chartData}
        >
          <RadialBar
            label={{ position: 'insideStart', fill: '#fff', fontSize: 11 }}
            background={{ fill: '#252A31' }}
            dataKey="value"
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            iconSize={10}
            wrapperStyle={{ color: '#ABB3BF' }}
          />
          {/* 중앙 총 에이전트 수 */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#F6F7F9"
            fontSize={24}
            fontWeight="bold"
          >
            {totalAgents}
          </text>
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            fill="#ABB3BF"
            fontSize={10}
          >
            에이전트
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  )
}
