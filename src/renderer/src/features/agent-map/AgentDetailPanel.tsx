import type { AgentNode as AgentNodeData, PipelineEdge } from '../../lib/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from './use-agent-graph'

type Props = {
  agent: AgentNodeData
  pipelines: PipelineEdge[]
  onClose: () => void
}

function modelLabel(model: string): { label: string; color: string; bg: string } {
  if (model === 'opus') return { label: 'Opus', color: '#7961DB', bg: 'rgba(121,97,219,0.2)' }
  if (model === 'sonnet') return { label: 'Sonnet', color: '#2D72D2', bg: 'rgba(45,114,210,0.2)' }
  return { label: model || 'Default', color: '#738091', bg: 'rgba(64,72,84,0.3)' }
}

export default function AgentDetailPanel({ agent, pipelines, onClose }: Props) {
  const color = CATEGORY_COLORS[agent.category] ?? '#6b7280'

  const relatedPipelines = pipelines.filter(
    (p) => p.from === agent.id || p.to === agent.id
  )

  return (
    <div className="w-80 h-full overflow-y-auto" style={{ backgroundColor: '#1C2127', borderLeft: '1px solid #404854' }}>
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #404854' }}>
        <h2 className="text-sm font-bold" style={{ color: '#F6F7F9' }}>{agent.name}</h2>
        <button
          onClick={onClose}
          className="text-lg leading-none transition-colors"
          style={{ color: '#738091' }}
        >
          &times;
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 카테고리 + 모델 */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}30`, color }}
          >
            {CATEGORY_LABELS[agent.category]}
          </span>
          {(() => { const ml = modelLabel(agent.model); return (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: ml.bg, color: ml.color }}
            >
              {ml.label}
            </span>
          )})()}
        </div>

        {/* 설명 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>설명</h3>
          <p className="text-sm leading-relaxed" style={{ color: '#ABB3BF' }}>{agent.description}</p>
        </div>

        {/* 도구 목록 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
            도구 ({agent.tools.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {agent.tools.map((tool) => (
              <span
                key={tool}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* 설정 */}
        <div>
          <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>설정</h3>
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt style={{ color: '#738091' }}>maxTurns</dt>
            <dd style={{ color: '#ABB3BF' }}>{agent.maxTurns ?? '-'}</dd>
            <dt style={{ color: '#738091' }}>memory</dt>
            <dd style={{ color: '#ABB3BF' }}>{agent.memory ?? '-'}</dd>
            <dt style={{ color: '#738091' }}>isolation</dt>
            <dd style={{ color: '#ABB3BF' }}>{agent.isolation ?? '-'}</dd>
          </dl>
        </div>

        {/* 관련 파이프라인 */}
        {relatedPipelines.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-1" style={{ color: '#738091' }}>
              파이프라인 ({relatedPipelines.length})
            </h3>
            <ul className="space-y-1">
              {relatedPipelines.map((p, i) => (
                <li
                  key={`${p.from}-${p.to}-${i}`}
                  className="text-xs flex items-center gap-1"
                >
                  <span style={{ color: '#738091' }}>[{p.pipelineName}]</span>
                  <span style={{ color: '#ABB3BF' }}>{p.from}</span>
                  <span style={{ color: '#404854' }}>&rarr;</span>
                  <span style={{ color: '#ABB3BF' }}>{p.to}</span>
                  {p.condition && (
                    <span className="text-[10px]" style={{ color: '#D1980B' }}>
                      ({p.condition})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
