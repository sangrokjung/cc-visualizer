import { useState, useMemo } from 'react'
import systemData from '../../data/system-data.json'

// 모델별 뱃지 색상 매핑
const MODEL_BADGE: Record<string, { label: string; color: string }> = {
  opus: { label: 'O', color: '#7961DB' },
  sonnet: { label: 'S', color: '#2D72D2' }
}

// 기본 모델 뱃지 (opus, sonnet 외)
const DEFAULT_BADGE = { label: 'D', color: '#404854' }

// 카테고리별 색상 — 그래프 노드 색상과 동기화
const PALANTIR_CATEGORY_COLORS: Record<string, string> = {
  marketing: '#29A634',
  review: '#7961DB',
  development: '#2D72D2',
  creative: '#DB2C6F',
  research: '#00A396',
  business: '#D1980B',
  legal: '#D33D17',
  operations: '#147EB3'
}

// 오브젝트 타입 정의
const OBJECT_TYPES = [
  { key: 'agents', icon: '🤖', label: '에이전트', expandable: true },
  { key: 'skills', icon: '⚡', label: '스킬', expandable: false },
  { key: 'hooks', icon: '🔗', label: '훅', expandable: false },
  { key: 'rules', icon: '📋', label: '규칙', expandable: false },
  { key: 'pipelines', icon: '🔀', label: '파이프라인', expandable: false },
  { key: 'mcpServers', icon: '🔌', label: 'MCP 서버', expandable: false }
] as const

type ObjectTypeKey = (typeof OBJECT_TYPES)[number]['key']

type Props = {
  activeFilter: string | null
  onFilterChange: (filter: string | null) => void
  onItemSelect: (type: string, id: string) => void
}

// 모델 뱃지 컴포넌트
function ModelBadge({ model }: { model: string }) {
  const badge = MODEL_BADGE[model] ?? DEFAULT_BADGE
  return (
    <span
      className="text-[9px] font-mono font-bold w-4 h-4 flex items-center justify-center rounded"
      style={{ color: badge.color, backgroundColor: `${badge.color}22` }}
    >
      {badge.label}
    </span>
  )
}

// 좌측 오브젝트 타입 네비게이션 패널
export function ObjectTypePanel({ activeFilter, onFilterChange, onItemSelect }: Props) {
  const [expandedType, setExpandedType] = useState<ObjectTypeKey | null>('agents')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // 에이전트를 카테고리별로 그룹핑
  const agentsByCategory = useMemo(() => {
    const groups: Record<string, typeof systemData.agents> = {}
    systemData.agents.forEach((a) => {
      ;(groups[a.category] ??= []).push(a)
    })
    return groups
  }, [])

  // 정렬된 카테고리 목록 (에이전트 수 내림차순)
  const sortedCategories = useMemo(() => {
    return Object.entries(agentsByCategory)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat]) => cat)
  }, [agentsByCategory])

  // 검색 필터링 — 에이전트 + 스킬
  const filteredAgents = useMemo(() => {
    if (!searchQuery) return systemData.agents
    const q = searchQuery.toLowerCase()
    return systemData.agents.filter((a) => a.name.toLowerCase().includes(q))
  }, [searchQuery])

  const filteredSkills = useMemo(() => {
    if (!searchQuery) return []
    const q = searchQuery.toLowerCase()
    return systemData.skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // 검색 중일 때 카테고리별 필터링된 에이전트
  const filteredAgentsByCategory = useMemo(() => {
    if (!searchQuery) return agentsByCategory
    const groups: Record<string, typeof systemData.agents> = {}
    filteredAgents.forEach((a) => {
      ;(groups[a.category] ??= []).push(a)
    })
    return groups
  }, [searchQuery, filteredAgents, agentsByCategory])

  // 타입별 카운트
  const counts: Record<ObjectTypeKey, number> = {
    agents: systemData.agents.length,
    skills: systemData.skills.length,
    hooks: systemData.hooks.length,
    rules: systemData.rules.length,
    pipelines: systemData.pipelines.length,
    mcpServers: systemData.mcpServers.length
  }

  // 타입 행 클릭 핸들러 — 필터 토글 + 펼침/접힘
  function handleTypeClick(type: (typeof OBJECT_TYPES)[number]) {
    // 필터 토글: 같은 타입 다시 클릭 시 해제
    const newFilter = activeFilter === type.key ? null : type.key
    onFilterChange(newFilter)

    // 펼침 가능한 타입이면 펼침/접힘 토글
    if (type.expandable) {
      setExpandedType(expandedType === type.key ? null : type.key)
    }
  }

  // 카테고리 행 클릭 핸들러
  function handleCategoryClick(category: string) {
    // 필터 토글: 같은 카테고리 다시 클릭 시 해제
    const newFilter = activeFilter === category ? null : category
    onFilterChange(newFilter)
  }

  // 카테고리 펼침/접힘 토글
  function toggleCategoryExpand(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  return (
    <div
      className="w-56 flex flex-col h-full overflow-hidden"
      style={{
        backgroundColor: '#1C2127',
        borderRight: '1px solid #404854'
      }}
    >
      {/* 헤더 */}
      <div className="px-4 py-3">
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: '#ABB3BF' }}
        >
          ONTOLOGY
        </span>
      </div>

      {/* 오브젝트 타입 목록 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto">
        {OBJECT_TYPES.map((type) => {
          const isActive = activeFilter === type.key
          const isExpanded = expandedType === type.key && type.expandable

          return (
            <div key={type.key}>
              {/* 타입 행 */}
              <button
                onClick={() => handleTypeClick(type)}
                className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors ${
                  isActive ? '' : 'hover:bg-[#2F343C]'
                }`}
                style={{
                  backgroundColor: isActive ? 'rgba(44,113,210,0.15)' : undefined,
                  borderLeft: isActive
                    ? '2px solid #2D72D2'
                    : '2px solid transparent'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{type.icon}</span>
                  <span className="text-xs" style={{ color: '#F6F7F9' }}>
                    {type.label}
                  </span>
                </div>
                {/* 카운트 뱃지 */}
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'rgba(138,187,255,0.2)',
                    color: '#8ABBFF'
                  }}
                >
                  {counts[type.key]}
                </span>
              </button>

              {/* 에이전트 카테고리별 그룹 (펼침 시) */}
              {isExpanded && (
                <div className="pb-1">
                  {sortedCategories
                    .filter((cat) => filteredAgentsByCategory[cat]?.length)
                    .map((category) => {
                      const agents = filteredAgentsByCategory[category]!
                      const catColor = PALANTIR_CATEGORY_COLORS[category] ?? '#ABB3BF'
                      const isCatActive = activeFilter === category
                      const isCatExpanded = expandedCategories.has(category)

                      return (
                        <div key={category}>
                          {/* 카테고리 행 */}
                          <button
                            onClick={() => handleCategoryClick(category)}
                            className={`w-full flex items-center justify-between pl-6 pr-4 py-1.5 transition-colors ${
                              isCatActive ? '' : 'hover:bg-[#2F343C]'
                            }`}
                            style={{
                              backgroundColor: isCatActive
                                ? `${catColor}15`
                                : undefined,
                              borderLeft: isCatActive
                                ? `2px solid ${catColor}`
                                : '2px solid transparent'
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              {/* 펼침/접힘 화살표 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleCategoryExpand(category)
                                }}
                                className="text-[10px] font-mono w-3 text-center hover:text-white transition-colors"
                                style={{ color: '#ABB3BF' }}
                              >
                                {isCatExpanded ? '▾' : '▸'}
                              </button>
                              {/* 색상 도트 */}
                              <span
                                className="w-2 h-2 rounded-full inline-block"
                                style={{ backgroundColor: catColor }}
                              />
                              <span className="text-xs" style={{ color: '#ABB3BF' }}>
                                {category}
                              </span>
                            </div>
                            <span
                              className="text-[10px] font-mono"
                              style={{ color: '#ABB3BF' }}
                            >
                              {agents.length}
                            </span>
                          </button>

                          {/* 카테고리 내 에이전트 인스턴스 목록 */}
                          {isCatExpanded &&
                            agents.map((agent, i) => (
                              <button
                                key={agent.id}
                                onClick={() => onItemSelect('agent', agent.id)}
                                className="w-full flex items-center justify-between pl-14 pr-4 py-1 transition-colors hover:bg-[#2F343C]"
                                style={{ color: '#ABB3BF' }}
                              >
                                <span className="text-xs flex items-center gap-1.5">
                                  {/* 트리 연결선 문자 */}
                                  <span
                                    className="text-[10px] font-mono"
                                    style={{ color: '#404854' }}
                                  >
                                    {i < agents.length - 1 ? '├' : '└'}
                                  </span>
                                  {agent.name}
                                </span>
                                <ModelBadge model={agent.model} />
                              </button>
                            ))}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}

        {/* 검색 결과: 스킬 섹션 (검색어가 있고 매칭 스킬이 있을 때만) */}
        {searchQuery && filteredSkills.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #404854' }}>
            <div className="px-4 py-1">
              <span className="text-[10px] font-bold tracking-wider" style={{ color: '#ABB3BF' }}>
                스킬 검색 결과
              </span>
            </div>
            {filteredSkills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => onItemSelect('skill', skill.id)}
                className="w-full flex items-center pl-6 pr-4 py-1 transition-colors hover:bg-[#2F343C]"
                style={{ color: '#ABB3BF' }}
              >
                <span className="text-xs truncate">{skill.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 하단 검색 입력 */}
      <div className="px-4 py-3">
        <input
          type="text"
          placeholder="에이전트 · 스킬 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded outline-none"
          style={{
            backgroundColor: '#252A31',
            border: '1px solid #404854',
            color: '#F6F7F9'
          }}
        />
      </div>
    </div>
  )
}
