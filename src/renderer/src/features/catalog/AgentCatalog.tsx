import { useState, useMemo } from 'react'
import type { AgentCategory } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'

type Agent = {
  id: string
  name: string
  description: string
  model: string
  tools: string[]
  category: string
  maxTurns?: number
  memory?: string
}

type Props = {
  agents: Agent[]
  searchQuery: string
}

const CATEGORIES: { id: AgentCategory; label: string }[] = [
  { id: 'development', label: '개발' },
  { id: 'review', label: '리뷰' },
  { id: 'business', label: '비즈니스' },
  { id: 'marketing', label: '마케팅' },
  { id: 'creative', label: '크리에이티브' },
  { id: 'research', label: '리서치' },
  { id: 'legal', label: '법무' },
  { id: 'operations', label: '운영' },
  { id: 'investment', label: '투자' },
  { id: 'lifestyle', label: '라이프' }
]

function getCatColor(category: string): string {
  return CATEGORY_COLORS[category as AgentCategory] ?? '#6b7280'
}

const MODEL_BADGE: Record<string, { color: string; label: string }> = {
  opus: { color: 'bg-purple-600/20 text-purple-400 border-purple-600/30', label: 'Opus' },
  sonnet: { color: 'bg-blue-600/20 text-blue-400 border-blue-600/30', label: 'Sonnet' },
  haiku: { color: 'bg-green-600/20 text-green-400 border-green-600/30', label: 'Haiku' }
}

function AgentDetailModal({
  agent,
  onClose
}: {
  agent: Agent
  onClose: () => void
}) {
  const catColor = getCatColor(agent.category)

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-[560px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: catColor }} />
            <div>
              <h2 className="text-lg font-bold text-white">{agent.name}</h2>
              <span className="text-xs text-gray-500 capitalize">{agent.category}</span>
            </div>
            <button
              onClick={onClose}
              className="ml-auto text-gray-500 hover:text-white text-lg"
            >
              x
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">설명</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{agent.description}</p>
          </div>

          <div className="flex gap-4">
            <ModelBadge model={agent.model} />
            {agent.maxTurns && (
              <span className="text-xs text-gray-400">최대 {agent.maxTurns}턴</span>
            )}
            {agent.memory && (
              <span className="text-xs text-gray-400">메모리: {agent.memory}</span>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              도구 ({agent.tools.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded-full border border-gray-700"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModelBadge({ model }: { model: string }) {
  const badge = MODEL_BADGE[model] ?? {
    color: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
    label: model
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${badge.color}`}>
      {badge.label}
    </span>
  )
}

export default function AgentCatalog({ agents, searchQuery }: Props) {
  const [activeCategory, setActiveCategory] = useState<AgentCategory | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      const matchCategory = !activeCategory || a.category === activeCategory
      const q = searchQuery.toLowerCase()
      const matchSearch =
        !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      return matchCategory && matchSearch
    })
  }, [agents, activeCategory, searchQuery])

  return (
    <div className="space-y-4">
      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = agents.filter((a) => a.category === cat.id).length
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(isActive ? null : cat.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                isActive
                  ? 'border-white/30 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
              style={isActive ? { backgroundColor: CATEGORY_COLORS[cat.id] + '33' } : undefined}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: CATEGORY_COLORS[cat.id] }}
              />
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-3 gap-3">
        {filtered.map((agent) => {
          const catColor = getCatColor(agent.category)
          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="text-left bg-gray-900/60 border border-gray-800 rounded-lg p-3 hover:border-gray-600 transition-colors"
              style={{ borderLeftColor: catColor, borderLeftWidth: 3 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white truncate">{agent.name}</span>
                <ModelBadge model={agent.model} />
              </div>
              <p className="text-xs text-gray-400 truncate mb-2">{agent.description}</p>
              <span className="text-[10px] text-gray-500">도구 {agent.tools.length}개</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-8 text-sm">검색 결과가 없습니다.</p>
      )}

      {selectedAgent && (
        <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  )
}
