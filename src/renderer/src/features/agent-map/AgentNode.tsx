import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { AgentNode as AgentNodeData } from '../../lib/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from './use-agent-graph'

function ModelBadge({ model }: { model: string }) {
  const config =
    model === 'opus'
      ? { label: 'O', bg: 'rgba(121,97,219,0.2)', color: '#7961DB' }
      : model === 'sonnet'
        ? { label: 'S', bg: 'rgba(45,114,210,0.2)', color: '#2D72D2' }
        : { label: 'D', bg: 'rgba(64,72,84,0.3)', color: '#738091' }

  return (
    <span
      className="text-[9px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded-full"
      style={{ backgroundColor: config.bg, color: config.color }}
      title={model}
    >
      {config.label}
    </span>
  )
}

function AgentNodeComponent({ data, selected }: NodeProps) {
  const agent = data as unknown as AgentNodeData
  const bgColor = CATEGORY_COLORS[agent.category] ?? '#6b7280'

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ backgroundColor: bgColor, border: 'none', width: 8, height: 8 }}
      />
      <div
        className="rounded-lg border px-3 py-2 shadow-lg min-w-[180px] cursor-pointer transition-all hover:scale-105"
        style={{
          backgroundColor: `${bgColor}20`,
          borderColor: selected ? bgColor : `${bgColor}60`,
          boxShadow: selected ? `0 0 24px ${bgColor}50` : undefined
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.boxShadow = `0 0 20px ${bgColor}30`
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.boxShadow = ''
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold truncate" style={{ color: '#F6F7F9' }}>
            {agent.name}
          </span>
          <ModelBadge model={agent.model} />
        </div>
        <p className="text-[10px] mt-1 truncate" style={{ color: '#ABB3BF' }}>
          {agent.description}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${bgColor}40`, color: bgColor }}
          >
            {CATEGORY_LABELS[agent.category] || agent.category}
          </span>
          <span className="text-[9px]" style={{ color: '#738091' }}>
            {'\u2699'} {agent.tools.length}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ backgroundColor: bgColor, border: 'none', width: 8, height: 8 }}
      />
    </>
  )
}

export default memo(AgentNodeComponent)
