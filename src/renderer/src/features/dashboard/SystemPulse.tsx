import { useMemo } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'

// 6개 도메인을 카운트 비례 버블로 시각화 — claude-code-anatomy 모듈 버블 차트 영감
// 단일 SVG, framer-motion 없이 CSS transform/transition만 사용 (성능 + 의존성 0)

type DomainBubble = {
  key: string
  label: string
  count: number
  color: string
  description: string
}

// 좌표는 viewBox 1000×400 기준. 6개를 시각적 균형 잡힌 별자리 배치.
const POSITIONS: { cx: number; cy: number }[] = [
  { cx: 200, cy: 200 }, // agents (좌, 대형)
  { cx: 480, cy: 180 }, // skills (중상)
  { cx: 680, cy: 280 }, // hooks (중하)
  { cx: 320, cy: 320 }, // rules (좌하)
  { cx: 800, cy: 160 }, // pipelines (우상)
  { cx: 900, cy: 290 } // mcp (우)
]

function bubbleRadius(count: number, max: number): number {
  // 최소 28, 최대 75 — 시각적 균형
  const min = 28
  const cap = 75
  const ratio = max === 0 ? 0 : count / max
  return min + (cap - min) * Math.sqrt(ratio)
}

function Bubble({
  position,
  radius,
  color,
  label,
  count,
  description,
  delayMs
}: {
  position: { cx: number; cy: number }
  radius: number
  color: string
  label: string
  count: number
  description: string
  delayMs: number
}) {
  return (
    <g
      style={{
        transformOrigin: `${position.cx}px ${position.cy}px`,
        animation: `pulse-grow 4s ease-in-out ${delayMs}ms infinite alternate`
      }}
    >
      {/* 외곽 글로우 — 후킹 핵심 */}
      <circle
        cx={position.cx}
        cy={position.cy}
        r={radius + 8}
        fill={color}
        opacity={0.08}
      />
      <circle
        cx={position.cx}
        cy={position.cy}
        r={radius}
        fill={`url(#grad-${label})`}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.92}
      />
      <text
        x={position.cx}
        y={position.cy - 4}
        textAnchor="middle"
        fontSize={Math.max(18, radius * 0.45)}
        fontWeight="800"
        fill="#F6F7F9"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      >
        {count}
      </text>
      <text
        x={position.cx}
        y={position.cy + radius * 0.4}
        textAnchor="middle"
        fontSize={13}
        fill="#ABB3BF"
        letterSpacing="0.05em"
      >
        {label}
      </text>
      {/* hover 상세 — title 태그로 native tooltip */}
      <title>
        {label}: {count} · {description}
      </title>
    </g>
  )
}

export function SystemPulse() {
  const { systemData } = useSystemDataContext()
  const { stats } = systemData

  const bubbles: DomainBubble[] = useMemo(
    () => [
      {
        key: 'agents',
        label: 'Agents',
        count: stats.agentCount,
        color: '#2D72D2',
        description: '전문 도메인 에이전트 — 자동 라우팅'
      },
      {
        key: 'skills',
        label: 'Skills',
        count: stats.skillCount,
        color: '#D1980B',
        description: 'Slash 명령어 — 직접 호출'
      },
      {
        key: 'hooks',
        label: 'Hooks',
        count: stats.hookCount,
        color: '#29A634',
        description: '이벤트 기반 자동 실행'
      },
      {
        key: 'rules',
        label: 'Rules',
        count: stats.ruleCount,
        color: '#7961DB',
        description: '거버넌스 · 정책 SSOT'
      },
      {
        key: 'pipelines',
        label: 'Pipelines',
        count: stats.pipelineCount,
        color: '#00A396',
        description: '다단계 자동화 흐름'
      },
      {
        key: 'mcp',
        label: 'MCP',
        count: stats.mcpServerCount,
        color: '#D33D17',
        description: 'Model Context Protocol 서버'
      }
    ],
    [stats]
  )

  const max = useMemo(() => Math.max(...bubbles.map((b) => b.count)), [bubbles])

  return (
    <div
      className="rounded-2xl p-6 border relative overflow-hidden"
      style={{
        backgroundColor: '#1C2127',
        borderColor: '#404854'
      }}
    >
      <style>{`
        @keyframes pulse-grow {
          from { transform: scale(1); }
          to { transform: scale(1.05); }
        }
        @keyframes connect-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -16; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: '#F6F7F9' }}>
            System Constellation
          </h3>
          <p className="text-[13px]" style={{ color: '#738091' }}>
            6개 도메인 카운트 비례 펄스 · hover로 상세
          </p>
        </div>
        <span
          className="text-xs uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(41,166,52,0.15)', color: '#29A634' }}
        >
          ● Pulsing
        </span>
      </div>

      <svg viewBox="0 0 1000 400" className="w-full h-[280px]">
        <defs>
          {bubbles.map((b) => (
            <radialGradient key={b.key} id={`grad-${b.label}`}>
              <stop offset="0%" stopColor={b.color} stopOpacity={0.85} />
              <stop offset="70%" stopColor={b.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={b.color} stopOpacity={0.15} />
            </radialGradient>
          ))}
        </defs>

        {/* 도메인 간 연결선 — 시스템 통합 시각 */}
        {POSITIONS.map((p1, i) =>
          POSITIONS.slice(i + 1).map((p2, j) => (
            <line
              key={`${i}-${j}`}
              x1={p1.cx}
              y1={p1.cy}
              x2={p2.cx}
              y2={p2.cy}
              stroke="#404854"
              strokeWidth={0.5}
              strokeOpacity={0.3}
              strokeDasharray="4 4"
              style={{ animation: `connect-flow 3s linear infinite` }}
            />
          ))
        )}

        {bubbles.map((bubble, i) => (
          <Bubble
            key={bubble.key}
            position={POSITIONS[i]}
            radius={bubbleRadius(bubble.count, max)}
            color={bubble.color}
            label={bubble.label}
            count={bubble.count}
            description={bubble.description}
            delayMs={i * 200}
          />
        ))}
      </svg>
    </div>
  )
}
