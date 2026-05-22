import { useMemo } from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { useSystemDataContext } from '../../lib/DataProvider'

// 팔란티어 10색 팔레트
const PALETTE = [
  '#2D72D2', '#7961DB', '#29A634', '#D1980B', '#DB2C6F',
  '#00A396', '#D33D17', '#147EB3', '#8ABBFF', '#62D96B'
]

// 커스텀 셀 렌더러
function CustomContent(props: any) {
  const { x, y, width, height, name, size } = props
  if (width < 40 || height < 30) return null
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={props.fill}
        stroke="#1C2127"
        strokeWidth={2}
        rx={4}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        fill="#fff"
        fontSize={13}
        fontWeight="bold"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        fill="#d1d5db"
        fontSize={12}
      >
        {size}
      </text>
    </g>
  )
}

export function SkillTreemap() {
  const { systemData } = useSystemDataContext()
  const treemapData = useMemo(() => {
    // skill.type 기준 그룹핑
    const groups: Record<string, number> = {}
    for (const skill of systemData.skills) {
      const group = (skill as any).type || 'unknown'
      groups[group] = (groups[group] || 0) + 1
    }
    return Object.entries(groups)
      .map(([name, size], i) => ({
        name,
        size,
        fill: PALETTE[i % PALETTE.length]
      }))
      .sort((a, b) => b.size - a.size)
  }, [systemData.skills])

  return (
    <div style={{ backgroundColor: '#1C2127', borderColor: '#404854' }} className="rounded-xl border p-5">
      <h3 style={{ color: '#F6F7F9' }} className="text-base font-semibold mb-3">스킬 분류 트리맵</h3>
      <ResponsiveContainer width="100%" height={300}>
        <Treemap
          data={treemapData}
          dataKey="size"
          nameKey="name"
          content={<CustomContent />}
        >
          <Tooltip
            contentStyle={{ background: '#1C2127', border: '1px solid #404854', borderRadius: 12 }}
            itemStyle={{ color: '#F6F7F9' }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
