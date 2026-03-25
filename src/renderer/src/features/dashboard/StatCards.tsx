import { useEffect, useRef, useState } from 'react'
import systemData from '../../data/system-data.json'

// easeOutQuart 이징 함수: 빠르게 시작 → 느리게 도착
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

// 0에서 target까지 카운트업 애니메이션 훅
function useCountUp(target: number, duration = 1000): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()

    function animate(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutQuart(progress)
      setValue(Math.round(eased * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

// 서브메트릭 계산 함수들
function getAgentSubMetric(): string {
  const models: Record<string, number> = {}
  for (const a of systemData.agents) {
    const m = a.model || 'default'
    models[m] = (models[m] || 0) + 1
  }
  const parts: string[] = []
  if (models.opus) parts.push(`Opus ${models.opus}`)
  if (models.sonnet) parts.push(`Sonnet ${models.sonnet}`)
  // opus, sonnet 외의 모든 모델을 Default로 합산
  const defaultCount = Object.entries(models)
    .filter(([k]) => k !== 'opus' && k !== 'sonnet')
    .reduce((sum, [, v]) => sum + v, 0)
  if (defaultCount > 0) parts.push(`Default ${defaultCount}`)
  return parts.join(' · ')
}

function getSkillSubMetric(): string {
  const types: Record<string, number> = {}
  for (const s of systemData.skills) {
    const t = s.type || 'unknown'
    types[t] = (types[t] || 0) + 1
  }
  return `디렉토리 ${types['skill-dir'] || 0} · 파일 ${types['skill-file'] || 0}`
}

function getHookSubMetric(): string {
  const events = new Set<string>()
  let totalCommands = 0
  for (const h of systemData.hooks) {
    events.add(h.event)
    totalCommands += 1
  }
  return `${events.size}개 이벤트 · ${totalCommands}개 커맨드`
}

function getRuleSubMetric(): string {
  const priorities: Record<string, number> = {}
  for (const r of systemData.rules) {
    const p = r.priority || 'normal'
    priorities[p] = (priorities[p] || 0) + 1
  }
  return `긴급 ${priorities.critical || 0} · 중요 ${priorities.important || 0} · 일반 ${priorities.normal || 0}`
}

function getPipelineSubMetric(): string {
  const totalSteps = systemData.pipelines.reduce(
    (sum, p) => sum + p.steps.length,
    0
  )
  return `총 ${totalSteps}단계`
}

function getMcpSubMetric(): string {
  return `${systemData.mcpServers.length}개 서버`
}

// 카드 정의
const CARD_CONFIGS = [
  {
    key: 'agentCount' as const,
    label: '에이전트',
    icon: '◆',
    accentColor: '#2D72D2',
    subMetric: getAgentSubMetric
  },
  {
    key: 'skillCount' as const,
    label: '스킬',
    icon: '⚙',
    accentColor: '#D1980B',
    subMetric: getSkillSubMetric
  },
  {
    key: 'hookCount' as const,
    label: '훅',
    icon: '⟁',
    accentColor: '#29A634',
    subMetric: getHookSubMetric
  },
  {
    key: 'ruleCount' as const,
    label: '규칙',
    icon: '≡',
    accentColor: '#7961DB',
    subMetric: getRuleSubMetric
  },
  {
    key: 'pipelineCount' as const,
    label: '파이프라인',
    icon: '⇉',
    accentColor: '#00A396',
    subMetric: getPipelineSubMetric
  },
  {
    key: 'mcpServerCount' as const,
    label: 'MCP 서버',
    icon: '⬡',
    accentColor: '#D33D17',
    subMetric: getMcpSubMetric
  }
]

// 개별 스탯 카드 컴포넌트
function StatCard({
  icon,
  label,
  value,
  accentColor,
  subMetric
}: {
  icon: string
  label: string
  value: number
  accentColor: string
  subMetric: string
}) {
  const animatedValue = useCountUp(value)

  return (
    <div
      className="rounded-xl border-l-4 p-4 transition-all duration-200 hover:scale-[1.02] cursor-default"
      style={{
        backgroundColor: '#1C2127',
        borderLeftColor: accentColor,
        boxShadow: 'none'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 15px rgba(45,114,210,0.15)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* 상단: 아이콘 + 라벨 */}
      <div className="flex items-center gap-2">
        <span className="text-lg" style={{ color: accentColor }}>
          {icon}
        </span>
        <span className="text-sm" style={{ color: '#ABB3BF' }}>
          {label}
        </span>
      </div>

      {/* 중앙: 애니메이션 숫자 */}
      <div className="mt-2">
        <span className="text-4xl font-bold" style={{ color: '#F6F7F9' }}>
          {animatedValue}
        </span>
      </div>

      {/* 하단: 서브메트릭 */}
      <p className="text-xs mt-2" style={{ color: '#738091' }}>
        {subMetric}
      </p>
    </div>
  )
}

export function StatCards() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {CARD_CONFIGS.map((config) => (
        <StatCard
          key={config.key}
          icon={config.icon}
          label={config.label}
          value={systemData.stats[config.key]}
          accentColor={config.accentColor}
          subMetric={config.subMetric()}
        />
      ))}
    </div>
  )
}
