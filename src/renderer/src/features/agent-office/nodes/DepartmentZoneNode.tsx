import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { JARVIS } from '../office-config'

type DepartmentZoneData = {
  category: string
  label: string
  emoji: string
  color: string
  agentCount: number
  floorColors?: [string, string]
}

// JARVIS 사이버틱 부서 zone — 픽셀 룸 → 홀로그램 셀
function DepartmentZoneNode({ data }: NodeProps) {
  const { label, emoji, color, agentCount, category } = data as unknown as DepartmentZoneData

  return (
    <div className="w-full h-full relative" style={{ pointerEvents: 'none' }}>
      {/* 배경 — 어두운 패널 + 부서 색상 약한 틴트 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: JARVIS.bgPanel,
          backgroundImage: `
            linear-gradient(135deg, ${color}08 0%, transparent 60%),
            linear-gradient(180deg, ${color}06 0%, transparent 50%)
          `,
        }}
      />

      {/* 그리드 패턴 (서브틀) */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `linear-gradient(${color}15 1px, transparent 1px), linear-gradient(90deg, ${color}15 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* 외곽 보더 + 글로우 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          border: `1px solid ${color}40`,
          boxShadow: `0 0 24px ${color}15, inset 0 0 32px ${color}08`,
        }}
      />

      {/* HUD 코너 마커 (4개) — 자비스 시그니처 */}
      {([
        { pos: 'top-0 left-0', borders: 'border-t border-l' },
        { pos: 'top-0 right-0', borders: 'border-t border-r' },
        { pos: 'bottom-0 left-0', borders: 'border-b border-l' },
        { pos: 'bottom-0 right-0', borders: 'border-b border-r' },
      ] as const).map((m, i) => (
        <span
          key={i}
          aria-hidden
          className={`absolute ${m.pos} w-3 h-3 ${m.borders}`}
          style={{ borderColor: color, borderWidth: '2px' }}
        />
      ))}

      {/* 상단 헤더 바 — 데이터 라인 */}
      <div
        className="absolute top-2 left-3 right-3 h-px"
        style={{ background: `linear-gradient(90deg, ${color}80, transparent)` }}
      />

      {/* 헤더 라벨 (HUD 스타일) */}
      <div
        className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1"
        style={{
          backgroundColor: `${JARVIS.bg}cc`,
          border: `1px solid ${color}80`,
          fontFamily: 'monospace',
          backdropFilter: 'blur(2px)',
        }}
      >
        <span style={{ fontSize: 11 }}>{emoji}</span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color }}
        >
          {label}
        </span>
        <span className="text-[9px]" style={{ color: JARVIS.textDim }}>·</span>
        <span
          className="text-[10px] font-mono font-bold tabular-nums"
          style={{ color: JARVIS.text }}
        >
          {agentCount.toString().padStart(2, '0')}
        </span>
        <span className="text-[8px] uppercase tracking-wider" style={{ color: JARVIS.textDim }}>
          units
        </span>
      </div>

      {/* 부서 코드 라벨 (우상단) */}
      <div
        className="absolute top-3 right-3 text-[8px] font-mono uppercase tracking-widest opacity-50"
        style={{ color }}
      >
        ZONE-{category.slice(0, 3).toUpperCase()}
      </div>
    </div>
  )
}

export default memo(DepartmentZoneNode)
