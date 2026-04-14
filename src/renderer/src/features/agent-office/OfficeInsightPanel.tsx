import { memo, useState } from 'react'
import type { AgentNode, PipelineEdge, SessionEvent } from '../../lib/types'
import { SESSION_EVENT_CONFIG } from '../../lib/types'
import AgentProfilePanel from './AgentProfilePanel'
import DeptUtilizationBars from './insight/DeptUtilizationBars'
import ToolCallsBar from './insight/ToolCallsBar'

type TabId = 'selected' | 'events' | 'stats'

interface OfficeInsightPanelProps {
  agents: AgentNode[]
  pipelines: PipelineEdge[]
  selectedAgent: AgentNode | null
  onDeselectAgent: () => void
  recentEvents: SessionEvent[]
  recentTools: Array<[string, number]>
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// 이벤트 미니 행
function MiniEventRow({ event }: { event: SessionEvent }) {
  const config = SESSION_EVENT_CONFIG[event.type] || SESSION_EVENT_CONFIG.system
  const detail = event.data.toolName
    || event.data.hookName
    || event.data.agentName?.slice(0, 30)
    || event.data.text?.slice(0, 40)
    || ''

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#252A31] transition-colors">
      <span
        className="w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0"
        style={{ backgroundColor: `${config.color}18`, color: config.color }}
      >
        {config.icon}
      </span>
      <span className="text-[10px] truncate flex-1" style={{ color: '#ABB3BF' }}>
        {detail}
      </span>
      <span className="text-[9px] font-mono shrink-0" style={{ color: '#5F6B7C' }}>
        {formatTime(event.timestamp)}
      </span>
    </div>
  )
}

export default memo(function OfficeInsightPanel({
  agents,
  pipelines,
  selectedAgent,
  onDeselectAgent,
  recentEvents,
  recentTools,
}: OfficeInsightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(selectedAgent ? 'selected' : 'stats')

  // 에이전트 선택 변경 시 탭 자동 전환
  const effectiveTab = selectedAgent && activeTab !== 'events' && activeTab !== 'stats' ? 'selected' : activeTab

  const tabs: { id: TabId; label: string }[] = [
    { id: 'selected', label: '선택됨' },
    { id: 'events', label: '이벤트' },
    { id: 'stats', label: '통계' },
  ]

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: '#161a22', borderLeft: '1px solid #404854' }}
      data-testid="office-insight-panel"
    >
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 text-[11px] py-2 transition-colors"
            style={{
              color: effectiveTab === tab.id ? '#F6F7F9' : '#5F6B7C',
              borderBottom: effectiveTab === tab.id ? '2px solid #2D72D2' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {effectiveTab === 'selected' && (
          selectedAgent ? (
            <AgentProfilePanel agent={selectedAgent} pipelines={pipelines} onClose={onDeselectAgent} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[11px]" style={{ color: '#5F6B7C' }}>
                에이전트를 클릭하세요
              </p>
            </div>
          )
        )}

        {effectiveTab === 'events' && (
          <div className="p-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: '#738091' }}>
              최근 이벤트 ({recentEvents.length})
            </h3>
            {recentEvents.length === 0 ? (
              <p className="text-[11px] text-center py-4" style={{ color: '#5F6B7C' }}>
                세션 이벤트 대기 중...
              </p>
            ) : (
              <div className="flex flex-col">
                {recentEvents.slice(0, 20).map((ev, i) => (
                  <MiniEventRow key={`${ev.timestamp}-${i}`} event={ev} />
                ))}
              </div>
            )}
          </div>
        )}

        {effectiveTab === 'stats' && (
          <div className="p-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: '#738091' }}>
              부서별 에이전트 분포
            </h3>
            <DeptUtilizationBars agents={agents} />

            <h3 className="text-[10px] font-semibold uppercase tracking-wider px-2 mt-4 mb-2" style={{ color: '#738091' }}>
              도구 호출 TOP
            </h3>
            <ToolCallsBar recentTools={recentTools} />
          </div>
        )}
      </div>
    </div>
  )
})
