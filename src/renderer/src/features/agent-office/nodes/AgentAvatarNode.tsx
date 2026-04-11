import { memo, useState, useCallback, useRef, useLayoutEffect, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { AgentNode } from '../../../lib/types'
import type { AgentStatus } from '../office-config'

type AvatarData = {
  agent: AgentNode
  status: AgentStatus
  modelConfig: {
    badge: string; headSize: number; rank: string; glow: boolean
    headColor: string; bodyScale: number
  }
  color: string
  pipelineCount: number
}

// 픽셀아트 캐릭터 SVG 렌더
function PixelCharacter({ size, color, headColor, status, glow, model }: {
  size: number; color: string; headColor: string;
  status: AgentStatus; glow: boolean; model: string
}) {
  // 32x32 viewBox 내에서 상세 캐릭터
  const s = size
  const skinColor = '#f5deb3'

  return (
    <svg
      width={s} height={s} viewBox="0 0 32 32"
      style={{
        imageRendering: 'pixelated',
        ...(glow ? { filter: `drop-shadow(0 0 6px ${headColor}80)` } : {})
      }}
    >
      {/* opus 왕관 */}
      {model === 'opus' && (
        <g>
          <polygon points="10,4 12,1 14,3 16,0 18,3 20,1 22,4" fill="#FFD700" stroke="#DAA520" strokeWidth="0.5" />
          <rect x="10" y="3" width="12" height="2" fill="#FFD700" />
        </g>
      )}

      {/* haiku 새싹 */}
      {model === 'haiku' && (
        <g>
          <ellipse cx="16" cy="3" rx="3" ry="2" fill="#4ade80" />
          <line x1="16" y1="5" x2="16" y2="7" stroke="#22c55e" strokeWidth="1" />
        </g>
      )}

      {/* 머리 */}
      <rect x="10" y={model === 'opus' ? 5 : 4} width="12" height="10" rx="3" fill={skinColor} />
      {/* 머리카락 */}
      <rect x="9" y={model === 'opus' ? 4 : 3} width="14" height="5" rx="2" fill={headColor} />

      {/* 눈 (상태별) — offline은 감은 눈, 그 외는 열린 눈 */}
      {status === 'offline' ? (
        <>
          {/* 감은 눈 */}
          <line x1="12" y1="10" x2="14" y2="10" stroke="#333" strokeWidth="1" strokeLinecap="round" />
          <line x1="18" y1="10" x2="20" y2="10" stroke="#333" strokeWidth="1" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="12" y="9" width="2" height="2" rx="0.5" fill="#222" />
          <rect x="18" y="9" width="2" height="2" rx="0.5" fill="#222" />
          {/* 눈 하이라이트 */}
          <rect x="12.5" y="9" width="1" height="1" fill="#fff" opacity="0.6" />
          <rect x="18.5" y="9" width="1" height="1" fill="#fff" opacity="0.6" />
        </>
      )}

      {/* 입 (4상태별) */}
      {status === 'working' ? (
        <ellipse cx="16" cy="13" rx="1.5" ry="1" fill="#c9302c" opacity="0.6" />
      ) : status === 'offline' ? (
        <path d="M14 12.5 Q16 14.5 18 12.5" fill="none" stroke="#c9302c" strokeWidth="0.8" opacity="0.6" />
      ) : status === 'recent' ? (
        <path d="M14 13 Q16 13.8 18 13" fill="none" stroke="#c9302c" strokeWidth="0.7" opacity="0.5" />
      ) : (
        <line x1="14.5" y1="13" x2="17.5" y2="13" stroke="#999" strokeWidth="0.8" />
      )}

      {/* 몸통 (카테고리 색상 셔츠) */}
      <rect x="9" y="14" width="14" height="9" rx="2" fill={color} />
      {/* 셔츠 디테일 */}
      <line x1="16" y1="14" x2="16" y2="20" stroke={color} strokeWidth="0.5" opacity="0.3" />
      {/* 칼라 */}
      <path d="M12 14.5 L16 16 L20 14.5" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.3" />

      {/* 팔 */}
      <rect x="7" y="15" width="3" height="6" rx="1" fill={color} />
      <rect x="22" y="15" width="3" height="6" rx="1" fill={color} />
      {/* 손 */}
      <rect x="7" y="20" width="3" height="2" rx="0.5" fill={skinColor} />
      <rect x="22" y="20" width="3" height="2" rx="0.5" fill={skinColor} />

      {/* 다리 */}
      <rect x="11" y="22" width="4" height="5" rx="1" fill="#2a2a3a" />
      <rect x="17" y="22" width="4" height="5" rx="1" fill="#2a2a3a" />
      {/* 신발 */}
      <rect x="10" y="26" width="5" height="2" rx="0.5" fill="#1a1a28" />
      <rect x="17" y="26" width="5" height="2" rx="0.5" fill="#1a1a28" />

      {/* sonnet 모델 뱃지 (넥타이 느낌) */}
      {model === 'sonnet' && (
        <rect x="15" y="15" width="2" height="4" rx="0.5" fill={headColor} opacity="0.6" />
      )}
    </svg>
  )
}

// 워크스테이션 SVG (책상 + 의자 + 모니터)
function Workstation({ width, color, isWorking }: { width: number; color: string; isWorking: boolean }) {
  return (
    <svg width={width} height={16} viewBox={`0 0 ${width} 16`} style={{ imageRendering: 'pixelated' }}>
      {/* 책상 */}
      <rect x="2" y="6" width={width-4} height="3" rx="0.5" fill="#5a4a35" />
      <rect x="2" y="5" width={width-4} height="2" rx="0.5" fill="#6a5a45" />
      {/* 책상 다리 */}
      <rect x="4" y="8" width="2" height="6" fill="#4a3a28" />
      <rect x={width-6} y="8" width="2" height="6" fill="#4a3a28" />
      {/* 모니터 */}
      <rect x={width/2-6} y="0" width="12" height="6" rx="0.5"
        fill={isWorking ? '#1a3a2a' : '#1a1a22'}
        stroke="#333" strokeWidth="0.5"
      />
      {isWorking && (
        <>
          {/* 화면 내용 (코드 라인들) */}
          <rect x={width/2-4} y="1.5" width="5" height="1" fill="#4ade80" opacity="0.6" />
          <rect x={width/2-4} y="3" width="7" height="1" fill="#60a5fa" opacity="0.4" />
        </>
      )}
      {/* 모니터 스탠드 */}
      <rect x={width/2-1} y="5" width="2" height="2" fill="#444" />
    </svg>
  )
}

function AgentAvatarNode({ data }: NodeProps) {
  const { agent, status, modelConfig, color, pipelineCount } = data as unknown as AvatarData
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipFlip, setTooltipFlip] = useState<{ vertical: boolean; horizontal: boolean }>({ vertical: false, horizontal: false })
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = useCallback(() => setShowTooltip(true), [])
  const handleMouseLeave = useCallback(() => setShowTooltip(false), [])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      nodeRef.current?.click()
    }
  }, [])

  // 뷰포트 경계 감지로 툴팁 위치 자동 전환
  useLayoutEffect(() => {
    if (!showTooltip || !nodeRef.current) return
    const rect = nodeRef.current.getBoundingClientRect()
    setTooltipFlip({
      vertical: rect.top < 150,
      horizontal: window.innerWidth - rect.right < 200,
    })
  }, [showTooltip])

  const animClass =
    status === 'working' ? 'animate-typing' :
    status === 'offline' ? 'animate-break' :
    'animate-idle'

  const statusLabel =
    status === 'working' ? '작업 중' :
    status === 'recent' ? '방금 활동' :
    status === 'idle' ? '대기 중' :
    '오프라인'

  const ariaLabel = `${agent.name}, ${modelConfig.rank}, ${statusLabel}, 도구 ${agent.tools.length}개${pipelineCount > 0 ? `, 파이프라인 ${pipelineCount}개` : ''}`

  const charSize = modelConfig.headSize
  const wsWidth = charSize + 12

  return (
    <div
      ref={nodeRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className="flex flex-col items-center cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
      style={{ width: 80, height: 100 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {/* 상태 말풍선 — working/recent/offline만 표시, idle은 숨김 */}
      {status !== 'idle' && (
        <div
          className="absolute -top-1 right-0 px-1 py-px rounded text-[8px] font-mono animate-fade-in-up"
          style={{
            backgroundColor: '#1C2127e0',
            border: '1px solid #404854',
            color:
              status === 'working' ? '#4ade80' :
              status === 'recent' ? '#60a5fa' :
              '#fbbf24',
            zIndex: 20,
          }}
        >
          {status === 'working' ? '...' : status === 'recent' ? '✓' : '☕'}
        </div>
      )}

      {/* 캐릭터 */}
      <div className={animClass}>
        <PixelCharacter
          size={charSize}
          color={color}
          headColor={modelConfig.headColor}
          status={status}
          glow={modelConfig.glow}
          model={agent.model}
        />
      </div>

      {/* 워크스테이션 (책상+모니터) */}
      <div className="mt-0.5">
        <Workstation width={wsWidth} color={color} isWorking={status === 'working'} />
      </div>

      {/* 이름 */}
      <span
        className="text-[8px] truncate text-center w-full leading-tight mt-0.5"
        style={{ fontFamily: 'monospace', color: '#9AA4B2' }}
        title={agent.name}
      >
        {agent.name.length > 10 ? agent.name.slice(0, 9) + '\u2026' : agent.name}
      </span>

      {/* 툴팁 (뷰포트 경계 자동 전환) */}
      {showTooltip && (
        <div
          className={`absolute pointer-events-none ${
            tooltipFlip.vertical
              ? 'top-full mt-2'
              : 'bottom-full mb-2'
          } ${
            tooltipFlip.horizontal
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'
          }`}
          style={{ zIndex: 100 }}
          role="tooltip"
        >
          <div
            className="rounded px-3 py-2 text-left whitespace-nowrap shadow-xl"
            style={{
              backgroundColor: '#0d0d14f0',
              border: `1px solid ${color}60`,
              fontFamily: 'monospace',
            }}
          >
            <p className="text-[11px] font-bold text-white">{agent.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#ABB3BF' }}>
              {modelConfig.badge} {modelConfig.rank} ({agent.model})
            </p>
            <p className="text-[10px] mt-0.5" style={{ color }}>
              {statusLabel} | 도구 {agent.tools.length}개
            </p>
            {pipelineCount > 0 && (
              <p className="text-[10px] mt-0.5" style={{ color: '#ABB3BF' }}>
                파이프라인 {pipelineCount}개
              </p>
            )}
            <p className="text-[9px] mt-1 max-w-[200px] truncate" style={{ color: '#9AA4B2' }}>
              {agent.description}
            </p>
          </div>
        </div>
      )}

      {/* 파이프라인 엣지 연결용 Handle — 투명, 노드 중앙 배치 */}
      <Handle type="target" position={Position.Left} className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0" />
      <Handle type="source" position={Position.Right} className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0" />
    </div>
  )
}

export default memo(AgentAvatarNode, (prev, next) => {
  const p = prev.data as unknown as AvatarData
  const n = next.data as unknown as AvatarData
  return (
    p.status === n.status &&
    p.agent.id === n.agent.id &&
    p.pipelineCount === n.pipelineCount &&
    p.color === n.color
  )
})
