import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

type DepartmentZoneData = {
  category: string
  label: string
  emoji: string
  color: string
  agentCount: number
  floorColors?: [string, string]
}

// 픽셀아트 부서 방 노드
function DepartmentZoneNode({ data }: NodeProps) {
  const { label, emoji, color, agentCount, floorColors } = data as unknown as DepartmentZoneData
  const [floor1, floor2] = floorColors ?? ['#191d28', '#1c2130']

  return (
    <div className="w-full h-full relative" style={{ imageRendering: 'pixelated' }}>
      {/* 바닥 타일 (SVG 패턴) */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id={`floor-${data.category}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill={floor1} />
            <rect x="0" y="0" width="8" height="8" fill={floor2} opacity="0.5" />
            <rect x="8" y="8" width="8" height="8" fill={floor2} opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#floor-${data.category})`} rx="2" />
      </svg>

      {/* 벽 (두꺼운 픽셀 테두리) */}
      <div
        className="absolute inset-0 rounded-sm pointer-events-none"
        style={{
          border: `4px solid ${color}40`,
          borderTopWidth: 6,
          boxShadow: `
            inset 0 2px 0 ${color}20,
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 2px 8px rgba(0,0,0,0.4)
          `,
        }}
      />

      {/* 벽 상단 두께감 (3D 효과) */}
      <div
        className="absolute top-0 left-0 right-0 h-2 rounded-t-sm"
        style={{ backgroundColor: color + '25' }}
      />

      {/* 문 (하단 중앙) */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: 24,
          height: 8,
          background: `linear-gradient(180deg, #4a3a2a, #3a2a1a)`,
          borderTop: `2px solid #6a5a4a`,
          borderRadius: '2px 2px 0 0',
        }}
      />

      {/* 간판 (상단 왼쪽) */}
      <div
        className="absolute top-1.5 left-2 flex items-center gap-1 px-2 py-0.5 rounded-sm"
        style={{
          backgroundColor: '#0a0a12e0',
          border: `1px solid ${color}50`,
          boxShadow: `0 1px 3px rgba(0,0,0,0.5)`,
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 11 }}>{emoji}</span>
        <span className="text-[10px] font-bold tracking-wide" style={{ color, fontFamily: 'monospace' }}>
          {label}
        </span>
        <span
          className="text-[8px] px-1 py-px rounded-sm font-mono font-bold ml-0.5"
          style={{ backgroundColor: color + '30', color }}
        >
          {agentCount}
        </span>
      </div>
    </div>
  )
}

export default memo(DepartmentZoneNode)
