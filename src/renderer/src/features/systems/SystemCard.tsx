import type { ExternalSystem } from '../../lib/types'
import { SYSTEM_CATEGORY_COLORS } from '../../lib/types'

// 카테고리 한글 라벨
const CATEGORY_LABELS: Record<string, string> = {
  'automation': '자동화',
  'content-automation': '콘텐츠',
  'finance-automation': '재무',
  'education-automation': '교육',
  'marketing-automation': '마케팅',
  'video-automation': '영상',
}

// 상태 색상
const STATUS_COLORS: Record<string, string> = {
  active: '#29A634',
  wip: '#D1980B',
  archived: '#738091',
  'not-found': '#DB2C6F',
}

type Props = {
  system: ExternalSystem
  onClick?: (system: ExternalSystem) => void
}

export function SystemCard({ system, onClick }: Props) {
  const catColor = SYSTEM_CATEGORY_COLORS[system.category] || '#738091'
  const statusColor = STATUS_COLORS[system.status] || '#738091'

  return (
    <div
      onClick={() => onClick?.(system)}
      className="rounded-xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
      style={{
        backgroundColor: '#1C2127',
        border: '1px solid #404854',
        boxShadow: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 20px ${catColor}20`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* 헤더: 상태 + 이름 + 카테고리 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <h3 className="text-sm font-bold" style={{ color: '#F6F7F9' }}>{system.name}</h3>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${catColor}20`, color: catColor }}
        >
          {CATEGORY_LABELS[system.category] || system.category}
        </span>
      </div>

      {/* 설명 (2줄 truncate) */}
      <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: '#ABB3BF' }}>
        {system.description}
      </p>

      {/* 기술 스택 뱃지 (최대 4개) */}
      <div className="flex flex-wrap gap-1 mb-3">
        {system.techStack.slice(0, 4).map((tech) => (
          <span
            key={tech}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
          >
            {tech}
          </span>
        ))}
        {system.techStack.length > 4 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#252A31', color: '#738091' }}
          >
            +{system.techStack.length - 4}
          </span>
        )}
      </div>

      {/* 에이전트/스킬/MCP 카운트 */}
      <div className="flex items-center gap-4 mb-3">
        {system.agents.length > 0 && (
          <span className="text-[10px]" style={{ color: '#ABB3BF' }}>
            ◆ {system.agents.length} Agents
          </span>
        )}
        {system.skills.length > 0 && (
          <span className="text-[10px]" style={{ color: '#ABB3BF' }}>
            ⚙ {system.skills.length} Skills
          </span>
        )}
        {system.mcpServers.length > 0 && (
          <span className="text-[10px]" style={{ color: '#ABB3BF' }}>
            ⬡ {system.mcpServers.length} MCP
          </span>
        )}
      </div>

      {/* 핵심 기능 (최대 3개) */}
      <div className="space-y-1">
        {system.keyFeatures.slice(0, 3).map((f, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-[10px] mt-0.5" style={{ color: catColor }}>•</span>
            <span className="text-[10px] leading-relaxed" style={{ color: '#738091' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
