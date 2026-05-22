import { memo, useState, useCallback, useRef, useLayoutEffect, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { AgentNode } from '../../../lib/types'
import type { AgentStatus } from '../office-config'
import { JARVIS } from '../office-config'

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

// 상태별 코어 컬러 — 청록 시그니처 + 활성 시 에메랄드 펄스
function statusColors(status: AgentStatus, model: string) {
  const isOpus = model === 'opus'
  switch (status) {
    case 'working':
      return { core: JARVIS.emerald, ring: JARVIS.primary, glow: 'rgba(16, 232, 140, 0.6)', label: JARVIS.emerald }
    case 'recent':
      return { core: JARVIS.primary, ring: JARVIS.primary, glow: 'rgba(0, 212, 255, 0.45)', label: JARVIS.primary }
    case 'idle':
      return { core: isOpus ? JARVIS.gold : JARVIS.primaryDim, ring: JARVIS.primaryDim, glow: 'rgba(0, 153, 204, 0.2)', label: JARVIS.textDim }
    case 'offline':
      return { core: '#2a3548', ring: '#1c3458', glow: 'rgba(28, 52, 88, 0.2)', label: '#3a4866' }
  }
}

// 자비스 홀로그램 코어 SVG — 헥사곤 + 회전 링 + 중앙 펄스
function JarvisCore({ size, status, model, glow }: {
  size: number; status: AgentStatus; model: string; glow: boolean
}) {
  const colors = statusColors(status, model)
  const isActive = status === 'working' || status === 'recent'
  const isOpus = model === 'opus'
  const isHaiku = model === 'haiku'

  // viewBox는 100×100 — 외곽 헥사곤 정점 좌표
  const hexPoints = '50,8 88,29 88,71 50,92 12,71 12,29'
  // 안쪽 작은 헥사곤
  const hexInnerPoints = '50,22 76,36 76,64 50,78 24,64 24,36'

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      style={{
        filter: glow || isActive
          ? `drop-shadow(0 0 ${isActive ? 8 : 4}px ${colors.glow})`
          : undefined,
      }}
    >
      {/* 외곽 회전 헥사곤 (working/recent만 회전) */}
      <polygon
        points={hexPoints}
        fill="none"
        stroke={colors.ring}
        strokeWidth="1.5"
        strokeOpacity={isActive ? 0.85 : 0.4}
        style={{
          transformOrigin: '50px 50px',
          animation: isActive ? `jarvis-spin-cw ${status === 'working' ? 8 : 14}s linear infinite` : undefined,
        }}
      />

      {/* 헥사곤 코너 마크 (HUD 느낌) */}
      {(['50,8', '88,29', '88,71', '50,92', '12,71', '12,29'] as const).map((p, i) => {
        const [cx, cy] = p.split(',').map(Number)
        return <circle key={i} cx={cx} cy={cy} r={1.5} fill={colors.ring} opacity={0.8} />
      })}

      {/* 안쪽 역회전 헥사곤 */}
      <polygon
        points={hexInnerPoints}
        fill="none"
        stroke={colors.core}
        strokeWidth="1"
        strokeOpacity={isActive ? 0.7 : 0.3}
        strokeDasharray={isActive ? '3 2' : undefined}
        style={{
          transformOrigin: '50px 50px',
          animation: isActive ? `jarvis-spin-ccw 6s linear infinite` : undefined,
        }}
      />

      {/* 중앙 코어 — 등급별 크기 */}
      <circle
        cx="50" cy="50"
        r={isOpus ? 16 : isHaiku ? 10 : 13}
        fill={`url(#core-grad-${status}-${model})`}
        opacity={status === 'offline' ? 0.3 : 0.9}
      />

      {/* 그라데이션 정의 */}
      <defs>
        <radialGradient id={`core-grad-${status}-${model}`}>
          <stop offset="0%" stopColor={colors.core} stopOpacity={1} />
          <stop offset="60%" stopColor={colors.core} stopOpacity={0.5} />
          <stop offset="100%" stopColor={colors.core} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* working — 다중 펄스 링 (강화) */}
      {status === 'working' && (
        <>
          {/* 외곽 큰 펄스 — 2초 주기 */}
          <circle
            cx="50" cy="50"
            r="8"
            fill="none"
            stroke={colors.core}
            strokeWidth="0.8"
            opacity={0.4}
            style={{ animation: 'jarvis-pulse-wide 2s ease-out infinite' }}
          />
          {/* 중간 펄스 */}
          <circle
            cx="50" cy="50"
            r="6"
            fill="none"
            stroke={colors.core}
            strokeWidth="1.5"
            style={{ animation: 'jarvis-pulse 1.4s ease-out infinite' }}
          />
          {/* 중앙 코어 호흡 */}
          <circle
            cx="50" cy="50"
            r="3"
            fill={colors.core}
            style={{ animation: 'jarvis-pulse-fill 1.4s ease-in-out infinite' }}
          />
        </>
      )}

      {/* recent — 부드러운 호흡 */}
      {status === 'recent' && (
        <circle
          cx="50" cy="50"
          r="3"
          fill={colors.core}
          opacity={0.8}
          style={{ animation: 'jarvis-breath 3s ease-in-out infinite' }}
        />
      )}

      {/* idle — 정적 코어 */}
      {status === 'idle' && (
        <circle cx="50" cy="50" r="2.5" fill={colors.core} opacity={0.5} />
      )}

      {/* opus 부장 — 상단 별 */}
      {isOpus && status !== 'offline' && (
        <polygon
          points="50,2 51.2,5 54.5,5 51.8,7 53,10 50,8.2 47,10 48.2,7 45.5,5 48.8,5"
          fill={JARVIS.gold}
          opacity={0.9}
          style={{ filter: `drop-shadow(0 0 2px ${JARVIS.gold})` }}
        />
      )}

      {/* opus working — 외곽 활성 점 */}
      {isOpus && status === 'working' && (
        <>
          <circle cx="50" cy="50" r="22" fill="none" stroke={JARVIS.gold} strokeWidth="0.5" strokeDasharray="2 3" opacity={0.5}
            style={{ transformOrigin: '50px 50px', animation: 'jarvis-spin-cw 12s linear infinite' }} />
        </>
      )}
    </svg>
  )
}

// 활동 데이터 스트림 — working 시 하단에 미니 진행 바
function ActivityStream({ width, status }: { width: number; status: AgentStatus }) {
  if (status === 'offline') return null
  const isWorking = status === 'working'
  const color = isWorking ? JARVIS.emerald : status === 'recent' ? JARVIS.primary : JARVIS.primaryDim
  return (
    <svg width={width} height={6} viewBox={`0 0 ${width} 6`} className="mt-1">
      {/* 베이스 라인 */}
      <line x1="2" y1="3" x2={width - 2} y2="3" stroke={color} strokeWidth="0.5" opacity={0.3} />
      {/* 스트림 dots */}
      {isWorking && (
        <>
          <circle cx="6" cy="3" r="1" fill={color}>
            <animate attributeName="cx" from="2" to={width - 2} dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="6" cy="3" r="1" fill={color}>
            <animate attributeName="cx" from="2" to={width - 2} dur="1.4s" begin="0.7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="1.4s" begin="0.7s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {status === 'recent' && (
        <circle cx={width / 2} cy="3" r="1" fill={color} opacity={0.7} />
      )}
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

  useLayoutEffect(() => {
    if (!showTooltip || !nodeRef.current) return
    const rect = nodeRef.current.getBoundingClientRect()
    setTooltipFlip({
      vertical: rect.top < 150,
      horizontal: window.innerWidth - rect.right < 200,
    })
  }, [showTooltip])

  const statusLabel =
    status === 'working' ? 'ACTIVE' :
    status === 'recent' ? 'STANDBY' :
    status === 'idle' ? 'IDLE' :
    'OFFLINE'

  const colors = statusColors(status, agent.model)
  const coreSize = modelConfig.headSize + 8 // 코어가 픽셀 머리보다 약간 큼
  const ariaLabel = `${agent.name}, ${modelConfig.rank}, ${statusLabel}, 도구 ${agent.tools.length}개${pipelineCount > 0 ? `, 파이프라인 ${pipelineCount}개` : ''}`

  // 게이미피케이션: 레벨 별 등급
  const tierStars = agent.model === 'opus' ? '★★★' : agent.model === 'sonnet' ? '★★' : '★'
  const tierLabel = agent.model === 'opus' ? 'CMD' : agent.model === 'sonnet' ? 'OPS' : 'JR'

  return (
    <div
      ref={nodeRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className="flex flex-col items-center cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      style={{
        width: 120, height: 140,
        padding: '6px 4px',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {/* 상단 티어 마커 — 레벨 별 (게이미피케이션) */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-1.5 pt-0.5">
        <span
          className="text-[8px] font-mono font-bold uppercase tracking-wider"
          style={{ color: colors.label, opacity: status === 'offline' ? 0.3 : 0.9 }}
        >
          {tierLabel}
        </span>
        <span
          className="text-[10px] font-bold"
          style={{
            color: status === 'offline' ? '#3a4866' : agent.model === 'opus' ? JARVIS.gold : colors.ring,
            letterSpacing: '-1px',
          }}
        >
          {tierStars}
        </span>
      </div>

      {/* JARVIS 코어 */}
      <div className="mt-3">
        <JarvisCore size={coreSize} status={status} model={agent.model} glow={modelConfig.glow} />
      </div>

      {/* 활동 스트림 */}
      <ActivityStream width={coreSize + 8} status={status} />

      {/* 상태 라벨 — 키운 사이즈 + 강조 */}
      <span
        className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] mt-1 px-1.5 py-px"
        style={{
          color: colors.label,
          backgroundColor: status !== 'offline' ? `${colors.core}15` : 'transparent',
          border: status === 'working' ? `1px solid ${colors.core}` : '1px solid transparent',
          boxShadow: status === 'working' ? `0 0 6px ${colors.glow}` : undefined,
        }}
      >
        {statusLabel}
      </span>

      {/* 에이전트 이름 — 키움 + 잘림 표시 개선 */}
      <span
        className="text-[10px] truncate text-center w-full leading-tight mt-1 font-mono font-semibold"
        style={{
          color: status === 'offline' ? '#3a4866' : JARVIS.text,
          maxWidth: '110px',
        }}
        title={agent.name}
      >
        {agent.name.length > 13 ? agent.name.slice(0, 12) + '…' : agent.name}
      </span>

      {/* 툴팁 — HUD 스타일 */}
      {showTooltip && (
        <div
          className={`absolute pointer-events-none ${
            tooltipFlip.vertical ? 'top-full mt-2' : 'bottom-full mb-2'
          } ${
            tooltipFlip.horizontal ? 'right-0' : 'left-1/2 -translate-x-1/2'
          }`}
          style={{ zIndex: 100 }}
          role="tooltip"
        >
          <div
            className="rounded px-3 py-2 text-left whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(2, 8, 23, 0.95)',
              border: `1px solid ${colors.ring}`,
              fontFamily: 'monospace',
              boxShadow: `0 0 12px ${colors.glow}, inset 0 0 8px rgba(0, 212, 255, 0.05)`,
            }}
          >
            {/* HUD 코너 마커 */}
            <div className="absolute -top-px -left-px w-2 h-2 border-t border-l" style={{ borderColor: colors.ring }} />
            <div className="absolute -top-px -right-px w-2 h-2 border-t border-r" style={{ borderColor: colors.ring }} />
            <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l" style={{ borderColor: colors.ring }} />
            <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r" style={{ borderColor: colors.ring }} />

            <p className="text-[11px] font-bold tracking-wide" style={{ color: JARVIS.text }}>
              {agent.name}
            </p>
            <p className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: JARVIS.textDim }}>
              ⟨ {modelConfig.rank} · {agent.model} ⟩
            </p>
            <p className="text-[9px] mt-px uppercase tracking-wider" style={{ color: colors.label }}>
              ▸ {statusLabel} · TOOLS {agent.tools.length}
              {pipelineCount > 0 && ` · LINKS ${pipelineCount}`}
            </p>
            {/* color는 카테고리 라인 */}
            <div className="h-px my-1.5" style={{ backgroundColor: color, opacity: 0.4 }} />
            <p className="text-[9px] max-w-[200px] truncate font-sans" style={{ color: JARVIS.textDim }}>
              {agent.description}
            </p>
          </div>
        </div>
      )}

      {/* Handles */}
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
