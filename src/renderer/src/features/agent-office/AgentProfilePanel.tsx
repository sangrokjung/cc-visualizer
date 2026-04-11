import { memo, useMemo } from 'react'
import type { AgentNode, AgentCategory, PipelineEdge } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'
import { DEPT_LABELS } from './office-config'

type Props = {
  agent: AgentNode
  pipelines: PipelineEdge[]
  onClose: () => void
}

const MODEL_INFO: Record<string, { badge: string; rank: string; color: string; label: string }> = {
  opus: { badge: '👑', rank: '부장', color: 'text-purple-400', label: 'Opus' },
  sonnet: { badge: '🎯', rank: '대리', color: 'text-blue-400', label: 'Sonnet' },
  haiku: { badge: '🌱', rank: '인턴', color: 'text-green-400', label: 'Haiku' }
}

function AgentProfilePanel({ agent, pipelines, onClose }: Props) {
  const catColor = CATEGORY_COLORS[agent.category as AgentCategory] ?? '#6b7280'
  const model = MODEL_INFO[agent.model] ?? MODEL_INFO.sonnet
  const deptLabel = DEPT_LABELS[agent.category as AgentCategory] ?? agent.category

  // 파이프라인 연결 정보
  const connections = useMemo(() => {
    const from = pipelines.filter((p) => p.from === agent.id)
    const to = pipelines.filter((p) => p.to === agent.id)
    return { from, to }
  }, [pipelines, agent.id])

  return (
    <div className="w-80 bg-[#1C2127] border-l border-gray-800 h-full overflow-y-auto flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-500">{deptLabel}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 대형 SVG 아바타 */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <svg
              width={80} height={80} viewBox="0 0 32 32"
              style={{
                imageRendering: 'pixelated',
                ...(agent.model === 'opus' ? { filter: `drop-shadow(0 0 8px ${catColor}80)` } : {})
              }}
            >
              {agent.model === 'opus' && (
                <g>
                  <polygon points="10,4 12,1 14,3 16,0 18,3 20,1 22,4" fill="#FFD700" stroke="#DAA520" strokeWidth="0.5" />
                  <rect x="10" y="3" width="12" height="2" fill="#FFD700" />
                </g>
              )}
              {agent.model === 'haiku' && (
                <g>
                  <ellipse cx="16" cy="3" rx="3" ry="2" fill="#4ade80" />
                  <line x1="16" y1="5" x2="16" y2="7" stroke="#22c55e" strokeWidth="1" />
                </g>
              )}
              <rect x="10" y={agent.model === 'opus' ? 5 : 4} width="12" height="10" rx="3" fill="#f5deb3" />
              <rect x="9" y={agent.model === 'opus' ? 4 : 3} width="14" height="5" rx="2" fill={catColor} />
              <rect x="12" y="9" width="2" height="2" rx="0.5" fill="#222" />
              <rect x="18" y="9" width="2" height="2" rx="0.5" fill="#222" />
              <rect x="12.5" y="9" width="1" height="1" fill="#fff" opacity="0.6" />
              <rect x="18.5" y="9" width="1" height="1" fill="#fff" opacity="0.6" />
              <line x1="14.5" y1="13" x2="17.5" y2="13" stroke="#999" strokeWidth="0.8" />
              <rect x="9" y="14" width="14" height="9" rx="2" fill={catColor} />
              <rect x="7" y="15" width="3" height="6" rx="1" fill={catColor} />
              <rect x="22" y="15" width="3" height="6" rx="1" fill={catColor} />
              <rect x="11" y="22" width="4" height="5" rx="1" fill="#2a2a3a" />
              <rect x="17" y="22" width="4" height="5" rx="1" fill="#2a2a3a" />
              <rect x="10" y="26" width="5" height="2" rx="0.5" fill="#1a1a28" />
              <rect x="17" y="26" width="5" height="2" rx="0.5" fill="#1a1a28" />
            </svg>
            <span className="absolute -top-1 -right-1 text-lg">{model.badge}</span>
          </div>

          <div className="text-center">
            <h2 className="text-base font-bold text-white">{agent.name}</h2>
            <p className={`text-xs ${model.color}`}>
              {model.rank} ({model.label})
            </p>
          </div>
        </div>
      </div>

      {/* 설명 */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          역할 설명
        </h3>
        <p className="text-xs text-gray-300 leading-relaxed">{agent.description}</p>
      </div>

      {/* 스탯 */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          스탯
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="도구" value={`${agent.tools.length}개`} />
          <StatCard label="모델" value={model.label} />
          {agent.maxTurns != null && <StatCard label="최대 턴" value={`${agent.maxTurns}`} />}
          {agent.memory != null && <StatCard label="메모리" value={agent.memory} />}
        </div>
      </div>

      {/* 파이프라인 연결 */}
      {(connections.from.length > 0 || connections.to.length > 0) && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            파이프라인 연결
          </h3>
          {connections.to.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-gray-500 mb-1">← 수신 ({connections.to.length})</p>
              {connections.to.map((p, i) => (
                <span
                  key={`to-${i}`}
                  className="inline-block px-2 py-0.5 text-[10px] bg-blue-900/30 text-blue-300 rounded-full border border-blue-800/50 mr-1 mb-1"
                >
                  {p.from}{p.condition ? ` (${p.condition})` : ''}
                </span>
              ))}
            </div>
          )}
          {connections.from.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 mb-1">→ 발신 ({connections.from.length})</p>
              {connections.from.map((p, i) => (
                <span
                  key={`from-${i}`}
                  className="inline-block px-2 py-0.5 text-[10px] bg-amber-900/30 text-amber-300 rounded-full border border-amber-800/50 mr-1 mb-1"
                >
                  {p.to}{p.condition ? ` (${p.condition})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 도구 목록 */}
      <div className="p-4 flex-1">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          도구 ({agent.tools.length})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {agent.tools.map((tool) => (
            <span
              key={tool}
              className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-300 rounded-full border border-gray-700"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

export default memo(AgentProfilePanel)