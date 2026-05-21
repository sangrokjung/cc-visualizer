import { memo, useState } from 'react'
import type { AgentNode, PipelineEdge, SessionEvent } from '../../lib/types'
import { SESSION_EVENT_CONFIG } from '../../lib/types'
import AgentProfilePanel from './AgentProfilePanel'
import DeptUtilizationBars from './insight/DeptUtilizationBars'
import ToolCallsBar from './insight/ToolCallsBar'
import { JARVIS } from './office-config'

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
    { id: 'selected', label: 'PROFILE' },
    { id: 'events', label: 'EVENTS' },
    { id: 'stats', label: 'TELEMETRY' },
  ]

  return (
    <div
      className="h-full flex flex-col overflow-hidden font-mono"
      style={{
        backgroundColor: JARVIS.bgPanel,
        borderLeft: `1px solid ${JARVIS.borderActive}30`,
      }}
      data-testid="office-insight-panel"
    >
      {/* HUD 탭 헤더 */}
      <div className="flex" style={{ borderBottom: `1px solid ${JARVIS.border}` }}>
        {tabs.map((tab) => {
          const active = effectiveTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 text-[10px] py-2 transition-all uppercase tracking-[0.2em] font-bold relative"
              style={{
                color: active ? JARVIS.primary : JARVIS.textDim,
                backgroundColor: active ? `${JARVIS.primary}10` : 'transparent',
                borderBottom: active ? `2px solid ${JARVIS.primary}` : '2px solid transparent',
                textShadow: active ? `0 0 6px ${JARVIS.primary}80` : undefined,
              }}
            >
              {active && <span className="mr-1">▸</span>}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {effectiveTab === 'selected' && (
          selectedAgent ? (
            <AgentProfilePanel agent={selectedAgent} pipelines={pipelines} onClose={onDeselectAgent} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
              <span className="text-3xl opacity-30">◇</span>
              <p className="text-[10px] uppercase tracking-widest text-center" style={{ color: JARVIS.textDim }}>
                NO TARGET SELECTED
              </p>
              <p className="text-[9px] text-center" style={{ color: JARVIS.textDim, opacity: 0.6 }}>
                Click any agent node
              </p>
            </div>
          )
        )}

        {effectiveTab === 'events' && (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: JARVIS.primary }}>
                ▸ EVENT STREAM
              </h3>
              <span
                className="text-[9px] tabular-nums px-1.5 py-px font-bold"
                style={{
                  color: recentEvents.length > 0 ? JARVIS.emerald : JARVIS.textDim,
                  border: `1px solid ${recentEvents.length > 0 ? JARVIS.emerald : JARVIS.border}`,
                  backgroundColor: recentEvents.length > 0 ? `${JARVIS.emerald}15` : 'transparent',
                }}
              >
                {recentEvents.length.toString().padStart(3, '0')}
              </span>
            </div>
            {recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="text-2xl opacity-30">⌛</span>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: JARVIS.textDim }}>
                  AWAITING STREAM
                </p>
              </div>
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
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] px-2 mb-2" style={{ color: JARVIS.primary }}>
              ▸ DEPT UTILIZATION
            </h3>
            <DeptUtilizationBars agents={agents} />

            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] px-2 mt-4 mb-2" style={{ color: JARVIS.gold }}>
              ▸ TOP TOOLS
            </h3>
            <ToolCallsBar recentTools={recentTools} />
          </div>
        )}
      </div>
    </div>
  )
})
