import { useMemo } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useSystemDataContext } from '../../lib/DataProvider'

// 카테고리 한글 라벨
const CATEGORY_LABELS: Record<string, string> = {
  marketing: '마케팅',
  review: '리뷰',
  development: '개발',
  creative: '크리에이티브',
  research: '리서치',
  business: '비즈니스',
  legal: '법무',
  operations: '운영',
  investment: '투자',
  lifestyle: '라이프'
}

// 레이더에 표시할 10개 카테고리
const RADAR_CATEGORIES = ['marketing', 'review', 'development', 'creative', 'research', 'business', 'legal', 'operations', 'investment', 'lifestyle']

export function SystemRadar() {
  const { systemData } = useSystemDataContext()
  const radarData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of systemData.agents) {
      counts[a.category] = (counts[a.category] || 0) + 1
    }
    return RADAR_CATEGORIES.map((cat) => ({
      category: CATEGORY_LABELS[cat] || cat,
      count: counts[cat] || 0
    }))
  }, [systemData.agents])

  return (
    <div style={{ backgroundColor: '#1C2127', borderColor: '#404854' }} className="rounded-xl border p-5">
      <h3 style={{ color: '#F6F7F9' }} className="text-base font-semibold mb-3">에이전트 카테고리 레이더</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#404854" />
          <PolarAngleAxis dataKey="category" tick={{ fill: '#ABB3BF', fontSize: 13 }} />
          <Radar
            dataKey="count"
            fill="#2D72D2"
            fillOpacity={0.25}
            stroke="#2D72D2"
            strokeWidth={2}
            dot={{ r: 4, fill: '#2D72D2' }}
          />
          <Tooltip
            contentStyle={{ background: '#1C2127', border: '1px solid #404854', borderRadius: 12 }}
            itemStyle={{ color: '#ABB3BF' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
