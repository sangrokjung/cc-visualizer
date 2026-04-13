import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'

const BAR_PALETTE = ['#2D72D2', '#7961DB', '#00A396', '#29A634', '#D1980B', '#DB2C6F', '#D33D17', '#147EB3', '#8ABBFF', '#62D96B']

interface Props {
  recentTools: Array<[string, number]>
}

// 최근 도구 호출 TOP 가로 바차트
export default memo(function ToolCallsBar({ recentTools }: Props) {
  const data = recentTools.slice(0, 8).map(([name, count]) => ({
    name: name.length > 14 ? `${name.slice(0, 12)}..` : name,
    fullName: name,
    value: count,
  }))

  if (data.length === 0) {
    return (
      <p className="text-[11px] text-center py-4" style={{ color: '#5F6B7C' }}>
        도구 호출 데이터 없음
      </p>
    )
  }

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 64 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 9, fill: '#ABB3BF' }}
            width={62}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1C2127', border: '1px solid #404854', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#ABB3BF' }}
            formatter={(value: number) => [`${value}회`, '호출']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
            {data.map((_entry, i) => (
              <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
