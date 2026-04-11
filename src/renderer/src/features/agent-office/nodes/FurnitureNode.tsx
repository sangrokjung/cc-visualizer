import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

type FurnitureData = {
  type: string
  w: number
  h: number
}

// 가구별 SVG 픽셀아트 렌더러
function renderFurniture(type: string, w: number, h: number) {
  const vb = `0 0 ${w} ${h}`

  switch (type) {
    case 'whiteboard':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="4" width={w-4} height={h-8} rx="1" fill="#e8e8e0" stroke="#999" strokeWidth="1" />
          <rect x="4" y="6" width={w-8} height={h-12} fill="#f5f5f0" />
          {/* 마커 메모 */}
          <line x1="8" y1="10" x2={w-12} y2="10" stroke="#e74c3c" strokeWidth="1.5" opacity="0.6" />
          <line x1="8" y1="14" x2={w-20} y2="14" stroke="#3498db" strokeWidth="1.5" opacity="0.6" />
          <line x1="8" y1="18" x2={w-16} y2="18" stroke="#2ecc71" strokeWidth="1.5" opacity="0.4" />
          {/* 다리 */}
          <rect x={w/2-1} y={h-4} width="2" height="4" fill="#888" />
        </svg>
      )

    case 'coffee_machine':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          {/* 본체 */}
          <rect x="4" y="6" width={w-8} height={h-10} rx="2" fill="#4a4a52" stroke="#333" strokeWidth="1" />
          {/* 물탱크 */}
          <rect x="6" y="3" width={w-12} height="5" rx="1" fill="#5a6a7a" opacity="0.7" />
          {/* 컵 받침 */}
          <rect x="6" y={h-6} width={w-12} height="3" rx="1" fill="#3a3a42" />
          {/* 빨간 불 */}
          <circle cx={w-8} cy="10" r="2" fill="#e74c3c" className="animate-monitor" />
          {/* 김 */}
          <g className="animate-steam" opacity="0.4">
            <path d={`M${w/2-2} 2 Q${w/2} -2 ${w/2+2} 2`} fill="none" stroke="#aaa" strokeWidth="1" />
          </g>
        </svg>
      )

    case 'plant_small':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          {/* 화분 */}
          <path d={`M${w/2-5} ${h-4} L${w/2-7} ${h} L${w/2+7} ${h} L${w/2+5} ${h-4} Z`} fill="#8B6914" />
          <rect x={w/2-6} y={h-6} width="12" height="3" rx="1" fill="#9B7924" />
          {/* 잎 */}
          <ellipse cx={w/2} cy={h-12} rx="6" ry="4" fill="#2d8a4e" />
          <ellipse cx={w/2-4} cy={h-14} rx="5" ry="3" fill="#34a853" transform={`rotate(-20 ${w/2-4} ${h-14})`} />
          <ellipse cx={w/2+4} cy={h-14} rx="5" ry="3" fill="#34a853" transform={`rotate(20 ${w/2+4} ${h-14})`} />
          {/* 줄기 */}
          <line x1={w/2} y1={h-6} x2={w/2} y2={h-10} stroke="#2d6a3e" strokeWidth="2" />
        </svg>
      )

    case 'plant_large':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          {/* 화분 */}
          <path d={`M${w/2-6} ${h-5} L${w/2-8} ${h} L${w/2+8} ${h} L${w/2+6} ${h-5} Z`} fill="#7B5914" />
          <rect x={w/2-7} y={h-7} width="14" height="3" rx="1" fill="#8B6924" />
          {/* 줄기 */}
          <line x1={w/2} y1={h-7} x2={w/2} y2="8" stroke="#2d6a3e" strokeWidth="2" />
          {/* 잎들 */}
          <ellipse cx={w/2-6} cy="10" rx="6" ry="4" fill="#2d8a4e" transform={`rotate(-30 ${w/2-6} 10)`} />
          <ellipse cx={w/2+6} cy="10" rx="6" ry="4" fill="#34a853" transform={`rotate(30 ${w/2+6} 10)`} />
          <ellipse cx={w/2} cy="6" rx="7" ry="4" fill="#3dba5e" />
          <ellipse cx={w/2-4} cy="14" rx="5" ry="3" fill="#2d8a4e" transform={`rotate(-15 ${w/2-4} 14)`} />
          <ellipse cx={w/2+4} cy="14" rx="5" ry="3" fill="#34a853" transform={`rotate(15 ${w/2+4} 14)`} />
        </svg>
      )

    case 'server_rack':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="2" width={w-4} height={h-4} rx="1" fill="#2a2a32" stroke="#1a1a22" strokeWidth="1" />
          {/* 서버 유닛들 */}
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <rect x="4" y={5 + i*8} width={w-8} height="6" rx="0.5" fill="#3a3a44" />
              <circle cx="7" cy={8 + i*8} r="1.5" fill={i % 2 === 0 ? '#2ecc71' : '#3498db'} className="animate-monitor" />
              <rect x={w-10} y={6 + i*8} width="4" height="4" rx="0.5" fill="#1a1a22" />
            </g>
          ))}
        </svg>
      )

    case 'bookshelf':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <rect x="1" y="1" width={w-2} height={h-2} fill="#5a4020" stroke="#4a3018" strokeWidth="1" />
          {/* 선반들 */}
          {[0, 1, 2].map(i => (
            <g key={i}>
              <rect x="2" y={3 + i*10} width={w-4} height="1.5" fill="#4a3018" />
              {/* 책들 */}
              {[0, 1, 2, 3].map(j => (
                <rect key={j} x={4 + j*6 + (i%2)*2} y={4 + i*10} width="4" height="8"
                  fill={['#c0392b','#2980b9','#27ae60','#8e44ad','#d35400','#16a085'][((i*4)+j)%6]}
                  rx="0.5" />
              ))}
            </g>
          ))}
        </svg>
      )

    case 'water_cooler':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          {/* 물통 */}
          <ellipse cx={w/2} cy="6" rx="6" ry="4" fill="#a8d8ea" opacity="0.7" />
          <rect x={w/2-5} y="6" width="10" height="10" fill="#a8d8ea" opacity="0.5" />
          {/* 본체 */}
          <rect x={w/2-6} y="14" width="12" height="10" rx="1" fill="#e0e0e0" stroke="#bbb" strokeWidth="0.5" />
          {/* 꼭지 */}
          <rect x={w/2-1} y="18" width="6" height="2" rx="0.5" fill="#999" />
          {/* 다리 */}
          <rect x={w/2-5} y={h-4} width="2" height="4" fill="#999" />
          <rect x={w/2+3} y={h-4} width="2" height="4" fill="#999" />
        </svg>
      )

    case 'meeting_table':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          {/* 테이블 상판 */}
          <ellipse cx={w/2} cy={h/2} rx={w/2-2} ry={h/2-4} fill="#6a5030" stroke="#5a4020" strokeWidth="1" />
          <ellipse cx={w/2} cy={h/2-1} rx={w/2-4} ry={h/2-6} fill="#7a6040" />
          {/* 의자들 (주변) */}
          <rect x="0" y={h/2-4} width="4" height="8" rx="1" fill="#3a3a4a" />
          <rect x={w-4} y={h/2-4} width="4" height="8" rx="1" fill="#3a3a4a" />
          <rect x={w/2-4} y="0" width="8" height="4" rx="1" fill="#3a3a4a" />
          <rect x={w/2-4} y={h-4} width="8" height="4" rx="1" fill="#3a3a4a" />
        </svg>
      )

    case 'printer':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="6" width={w-4} height={h-10} rx="1" fill="#d0d0d0" stroke="#aaa" strokeWidth="0.5" />
          {/* 용지함 */}
          <rect x="4" y="3" width={w-8} height="4" fill="#f0f0f0" stroke="#ccc" strokeWidth="0.5" />
          {/* 출력물 */}
          <rect x="6" y={h-6} width={w-12} height="3" fill="#fff" />
          {/* 버튼 */}
          <circle cx={w-6} cy="10" r="1.5" fill="#2ecc71" />
        </svg>
      )

    case 'sofa':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          {/* 등받이 */}
          <rect x="2" y="2" width={w-4} height={h/2} rx="3" fill="#4a3a5a" />
          {/* 시트 */}
          <rect x="1" y={h/2} width={w-2} height={h/2-2} rx="2" fill="#5a4a6a" />
          {/* 팔걸이 */}
          <rect x="0" y="4" width="4" height={h-6} rx="2" fill="#4a3a5a" />
          <rect x={w-4} y="4" width="4" height={h-6} rx="2" fill="#4a3a5a" />
          {/* 쿠션 라인 */}
          <line x1={w/2} y1={h/2+2} x2={w/2} y2={h-4} stroke="#4a3a5a" strokeWidth="1" />
        </svg>
      )

    case 'filing_cabinet':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <rect x="2" y="2" width={w-4} height={h-4} rx="1" fill="#6a6a72" stroke="#5a5a62" strokeWidth="1" />
          {/* 서랍들 */}
          {[0, 1, 2].map(i => (
            <g key={i}>
              <rect x="4" y={4 + i*8} width={w-8} height="6" fill="#7a7a82" rx="0.5" />
              <rect x={w/2-2} y={6 + i*8} width="4" height="2" rx="0.5" fill="#aaa" />
            </g>
          ))}
        </svg>
      )

    case 'trash_bin':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <path d={`M${w/2-5} 4 L${w/2-6} ${h-2} L${w/2+6} ${h-2} L${w/2+5} 4 Z`} fill="#5a5a62" />
          <rect x={w/2-6} y="2" width="12" height="3" rx="1" fill="#6a6a72" />
          <rect x={w/2-1} y="0" width="2" height="3" fill="#6a6a72" />
        </svg>
      )

    case 'clock':
      return (
        <svg width={w} height={h} viewBox={vb} style={{ imageRendering: 'pixelated' }}>
          <circle cx={w/2} cy={h/2} r={Math.min(w,h)/2-2} fill="#1a1a22" stroke="#4a4a52" strokeWidth="1" />
          <circle cx={w/2} cy={h/2} r="1" fill="#e0e0e0" />
          <line x1={w/2} y1={h/2} x2={w/2} y2={h/2-5} stroke="#e0e0e0" strokeWidth="1" />
          <line x1={w/2} y1={h/2} x2={w/2+3} y2={h/2+1} stroke="#e0e0e0" strokeWidth="0.8" />
        </svg>
      )

    default:
      return (
        <svg width={w} height={h} viewBox={vb}>
          <rect width={w} height={h} fill="#333" rx="2" opacity="0.3" />
        </svg>
      )
  }
}

// 픽셀아트 가구 노드
function FurnitureNode({ data }: NodeProps) {
  const { type, w, h } = data as unknown as FurnitureData
  return (
    <div className="select-none" style={{ width: w, height: h }}>
      {renderFurniture(type, w, h)}
    </div>
  )
}

export default memo(FurnitureNode)
