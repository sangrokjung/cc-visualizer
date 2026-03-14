import { useState, useMemo } from 'react'
import systemData from '../../data/system-data.json'
import AgentCatalog from './AgentCatalog'
import SkillCatalog from './SkillCatalog'
import HookRuleCatalog from './HookRuleCatalog'

type Tab = 'agents' | 'skills' | 'hooks-rules'

export default function CatalogView() {
  const [activeTab, setActiveTab] = useState<Tab>('agents')
  const [searchQuery, setSearchQuery] = useState('')

  const agents = systemData.agents
  const skills = systemData.skills
  const hooks = systemData.hooks
  const rules = systemData.rules

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: 'agents', label: `에이전트(${agents.length})` },
      { id: 'skills', label: `스킬(${skills.length})` },
      { id: 'hooks-rules', label: `훅&규칙(${hooks.length}+${rules.length})` }
    ],
    [agents.length, skills.length, hooks.length, rules.length]
  )

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* 헤더: 탭 + 검색 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="검색..."
          className="ml-auto w-64 px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'agents' && (
          <AgentCatalog agents={agents} searchQuery={searchQuery} />
        )}
        {activeTab === 'skills' && (
          <SkillCatalog skills={skills} searchQuery={searchQuery} />
        )}
        {activeTab === 'hooks-rules' && (
          <HookRuleCatalog hooks={hooks} rules={rules} searchQuery={searchQuery} />
        )}
      </div>
    </div>
  )
}
