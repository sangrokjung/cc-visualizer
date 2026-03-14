import type { ExternalSystem } from '../../lib/types'
import { SYSTEM_CATEGORY_COLORS } from '../../lib/types'

type Props = {
  system: ExternalSystem
  onClose: () => void
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: 'rgba(41,166,52,0.2)', color: '#29A634' },
  wip: { bg: 'rgba(209,152,11,0.2)', color: '#D1980B' },
  archived: { bg: 'rgba(115,128,145,0.2)', color: '#738091' },
  'not-found': { bg: 'rgba(219,44,111,0.2)', color: '#DB2C6F' },
}

export function SystemDetailPanel({ system, onClose }: Props) {
  const catColor = SYSTEM_CATEGORY_COLORS[system.category] || '#738091'
  const statusStyle = STATUS_STYLE[system.status] || STATUS_STYLE.archived

  return (
    <div
      className="w-80 h-full overflow-y-auto"
      style={{ backgroundColor: '#1C2127', borderLeft: '1px solid #404854' }}
    >
      {/* 헤더 */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #404854' }}
      >
        <h2 className="text-sm font-bold" style={{ color: '#F6F7F9' }}>
          {system.name}
        </h2>
        <button
          onClick={onClose}
          className="text-lg leading-none transition-colors"
          style={{ color: '#738091' }}
        >
          &times;
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 상태 + 카테고리 */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
          >
            {system.status}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${catColor}20`, color: catColor }}
          >
            {system.category}
          </span>
        </div>

        {/* 설명 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
            설명
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: '#ABB3BF' }}>
            {system.description}
          </p>
        </div>

        {/* 기술 스택 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
            기술 스택
          </h3>
          <div className="flex flex-wrap gap-1">
            {system.techStack.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* 에이전트 */}
        {system.agents.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
              에이전트 ({system.agents.length})
            </h3>
            <div className="space-y-1">
              {system.agents.map((a) => (
                <div
                  key={a}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
                >
                  ◆ {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 스킬 */}
        {system.skills.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
              스킬 ({system.skills.length})
            </h3>
            <div className="space-y-1">
              {system.skills.map((s) => (
                <div
                  key={s}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
                >
                  ⚙ {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MCP */}
        {system.mcpServers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
              MCP 서버 ({system.mcpServers.length})
            </h3>
            <div className="space-y-1">
              {system.mcpServers.map((m) => (
                <div
                  key={m}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
                >
                  ⬡ {m}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 핵심 기능 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
            핵심 기능
          </h3>
          <div className="space-y-1.5">
            {system.keyFeatures.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-[10px] mt-0.5" style={{ color: catColor }}>
                  •
                </span>
                <span className="text-xs leading-relaxed" style={{ color: '#ABB3BF' }}>
                  {f}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 경로 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
            경로
          </h3>
          <p className="text-[10px] font-mono" style={{ color: '#5F6B7C' }}>
            {system.path}
          </p>
        </div>
      </div>
    </div>
  )
}
