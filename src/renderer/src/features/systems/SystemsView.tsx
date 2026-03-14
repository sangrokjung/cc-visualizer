import { useState, useMemo } from 'react'
import { SystemCard } from './SystemCard'
import { SystemDetailPanel } from './SystemDetailPanel'
import externalSystems from '../../data/external-systems.json'
import type { ExternalSystem } from '../../lib/types'
import { SYSTEM_CATEGORY_COLORS } from '../../lib/types'

const systems = externalSystems as ExternalSystem[]

const CATEGORIES = [
  { key: null as string | null, label: '전체' },
  { key: 'automation', label: '자동화' },
  { key: 'content-automation', label: '콘텐츠' },
  { key: 'finance-automation', label: '재무' },
  { key: 'education-automation', label: '교육' },
  { key: 'marketing-automation', label: '마케팅' },
  { key: 'video-automation', label: '영상' },
]

export default function SystemsView() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedSystem, setSelectedSystem] = useState<ExternalSystem | null>(null)

  const filtered = useMemo(() => {
    if (!activeCategory) return systems
    return systems.filter((s) => s.category === activeCategory)
  }, [activeCategory])

  const stats = useMemo(
    () => ({
      active: systems.filter((s) => s.status === 'active').length,
      wip: systems.filter((s) => s.status === 'wip').length,
      totalAgents: systems.reduce((sum, s) => sum + s.agents.length, 0),
      totalSkills: systems.reduce((sum, s) => sum + s.skills.length, 0),
      totalMcp: systems.reduce((sum, s) => sum + s.mcpServers.length, 0),
    }),
    []
  )

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#111418' }}>
        <div className="max-w-[1400px] mx-auto p-6 space-y-6">
          {/* 히어로 */}
          <div
            className="rounded-2xl p-6"
            style={{
              background:
                'linear-gradient(135deg, rgba(45,114,210,0.12) 0%, rgba(121,97,219,0.08) 50%, rgba(0,163,150,0.12) 100%)',
              border: '1px solid rgba(45,114,210,0.2)',
            }}
          >
            <h1 className="text-xl font-bold" style={{ color: '#F6F7F9' }}>
              QJC Automation Ecosystem
            </h1>
            <p className="text-xs mt-1" style={{ color: '#ABB3BF' }}>
              QJC가 운영하는 AI 자동화 시스템 전체 현황
            </p>
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#29A634' }} />
                <span className="text-xs" style={{ color: '#ABB3BF' }}>
                  Active {stats.active}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#D1980B' }} />
                <span className="text-xs" style={{ color: '#ABB3BF' }}>
                  WIP {stats.wip}
                </span>
              </div>
              <span style={{ color: '#404854' }}>|</span>
              <span className="text-xs" style={{ color: '#ABB3BF' }}>
                ◆ {stats.totalAgents} Agents
              </span>
              <span className="text-xs" style={{ color: '#ABB3BF' }}>
                ⚙ {stats.totalSkills} Skills
              </span>
              <span className="text-xs" style={{ color: '#ABB3BF' }}>
                ⬡ {stats.totalMcp} MCP
              </span>
            </div>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key
              const color = cat.key
                ? SYSTEM_CATEGORY_COLORS[cat.key] || '#738091'
                : '#2D72D2'
              return (
                <button
                  key={cat.key ?? 'all'}
                  onClick={() => setActiveCategory(cat.key)}
                  className="text-[11px] px-3 py-1.5 rounded-full border transition-colors"
                  style={{
                    borderColor: isActive ? color : '#404854',
                    backgroundColor: isActive ? `${color}15` : 'transparent',
                    color: isActive ? color : '#738091',
                  }}
                >
                  {cat.label}
                </button>
              )
            })}
            <span className="ml-auto text-[11px]" style={{ color: '#5F6B7C' }}>
              {filtered.length}개 시스템
            </span>
          </div>

          {/* 시스템 카드 그리드 */}
          <div className="grid grid-cols-3 gap-5">
            {filtered.map((system) => (
              <SystemCard key={system.id} system={system} onClick={setSelectedSystem} />
            ))}
          </div>
        </div>
      </div>

      {/* 디테일 패널 */}
      {selectedSystem && (
        <SystemDetailPanel
          system={selectedSystem}
          onClose={() => setSelectedSystem(null)}
        />
      )}
    </div>
  )
}
