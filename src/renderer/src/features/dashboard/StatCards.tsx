import { useMemo } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'
import { useCountUp } from '../../lib/hooks/use-count-up'

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
      <div className="flex items-center gap-2">
        <span className="text-lg" style={{ color: accentColor }}>
          {icon}
        </span>
        <span className="text-sm" style={{ color: '#ABB3BF' }}>
          {label}
        </span>
      </div>

      <div className="mt-2">
        <span className="text-4xl font-bold" style={{ color: '#F6F7F9' }}>
          {animatedValue}
        </span>
      </div>

      <p className="text-xs mt-2" style={{ color: '#738091' }}>
        {subMetric}
      </p>
    </div>
  )
}

export function StatCards() {
  const { systemData } = useSystemDataContext()

  const cardConfigs = useMemo(() => {
    // 서브메트릭 계산
    const agentSub = (() => {
      const models: Record<string, number> = {}
      for (const a of systemData.agents) {
        const m = a.model || 'default'
        models[m] = (models[m] || 0) + 1
      }
      const parts: string[] = []
      if (models.opus) parts.push(`Opus ${models.opus}`)
      if (models.sonnet) parts.push(`Sonnet ${models.sonnet}`)
      const defaultCount = Object.entries(models)
        .filter(([k]) => k !== 'opus' && k !== 'sonnet')
        .reduce((sum, [, v]) => sum + v, 0)
      if (defaultCount > 0) parts.push(`Default ${defaultCount}`)
      return parts.join(' · ')
    })()

    const skillSub = (() => {
      const types: Record<string, number> = {}
      for (const s of systemData.skills) {
        const t = s.type || 'unknown'
        types[t] = (types[t] || 0) + 1
      }
      return `디렉토리 ${types['skill-dir'] || 0} · 파일 ${types['skill-file'] || 0}`
    })()

    const hookSub = (() => {
      const events = new Set<string>()
      let totalCommands = 0
      for (const h of systemData.hooks) {
        events.add(h.event)
        totalCommands += 1
      }
      return `${events.size}개 이벤트 · ${totalCommands}개 커맨드`
    })()

    const ruleSub = (() => {
      const priorities: Record<string, number> = {}
      for (const r of systemData.rules) {
        const p = r.priority || 'normal'
        priorities[p] = (priorities[p] || 0) + 1
      }
      return `긴급 ${priorities.critical || 0} · 중요 ${priorities.important || 0} · 일반 ${priorities.normal || 0}`
    })()

    const pipelineSub = (() => {
      const totalSteps = systemData.pipelines.reduce(
        (sum, p) => sum + p.steps.length,
        0
      )
      return `총 ${totalSteps}단계`
    })()

    const mcpSub = `${systemData.mcpServers.length}개 서버`

    return [
      { key: 'agentCount' as const, label: '에이전트', icon: '◆', accentColor: '#2D72D2', subMetric: agentSub },
      { key: 'skillCount' as const, label: '스킬', icon: '⚙', accentColor: '#D1980B', subMetric: skillSub },
      { key: 'hookCount' as const, label: '훅', icon: '⟁', accentColor: '#29A634', subMetric: hookSub },
      { key: 'ruleCount' as const, label: '규칙', icon: '≡', accentColor: '#7961DB', subMetric: ruleSub },
      { key: 'pipelineCount' as const, label: '파이프라인', icon: '⇉', accentColor: '#00A396', subMetric: pipelineSub },
      { key: 'mcpServerCount' as const, label: 'MCP 서버', icon: '⬡', accentColor: '#D33D17', subMetric: mcpSub }
    ]
  }, [systemData])

  return (
    <div className="grid grid-cols-3 gap-4">
      {cardConfigs.map((config) => (
        <StatCard
          key={config.key}
          icon={config.icon}
          label={config.label}
          value={systemData.stats[config.key]}
          accentColor={config.accentColor}
          subMetric={config.subMetric}
        />
      ))}
    </div>
  )
}
