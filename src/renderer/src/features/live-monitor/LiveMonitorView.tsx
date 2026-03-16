import { useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { useSessionEvents } from './use-session-events'
import { useFileWatcher } from './use-file-watcher'
import { SESSION_EVENT_CONFIG } from '../../lib/types'
import type { SessionEvent } from '../../lib/types'

// 팔란티어 색상
const C = {
  bg: '#111418',
  card: '#1C2127',
  cardSub: '#252A31',
  border: '#404854',
  text: '#F6F7F9',
  textSub: '#ABB3BF',
  textWeak: '#738091',
  textDim: '#5F6B7C',
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// 이벤트 행
function EventRow({ event }: { event: SessionEvent }) {
  const config = SESSION_EVENT_CONFIG[event.type] || SESSION_EVENT_CONFIG.system
  const detail = event.data.toolName
    || event.data.hookName
    || event.data.agentName?.slice(0, 40)
    || event.data.text?.slice(0, 60)
    || ''

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors hover:bg-[#252A31]">
      <span
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: `${config.color}18`, color: config.color }}
      >
        {config.icon}
      </span>
      <span className="text-[10px] shrink-0" style={{ color: config.color }}>
        {config.label}
      </span>
      <span className="text-[11px] font-mono truncate flex-1" style={{ color: C.textSub }}>
        {detail}
      </span>
      <span className="text-[10px] font-mono shrink-0" style={{ color: C.textDim }}>
        {formatTime(event.timestamp)}
      </span>
    </div>
  )
}

// 통계 카드
function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-center" style={{ backgroundColor: C.cardSub }}>
      <p className="text-lg font-bold" style={{ color }}>{count}</p>
      <p className="text-[10px]" style={{ color: C.textWeak }}>{label}</p>
    </div>
  )
}

// 바 차트 색상 팔레트
const BAR_PALETTE = ['#2D72D2', '#7961DB', '#00A396', '#29A634', '#D1980B', '#DB2C6F', '#D33D17', '#147EB3', '#8ABBFF', '#62D96B']

export default function LiveMonitorView() {
  const { events: sessionEvents, sessionId, clearEvents, activeAgents, stats, recentTools } = useSessionEvents()
  const { events: fileEvents } = useFileWatcher()
  const timelineRef = useRef<HTMLDivElement>(null)

  // 새 이벤트 시 자동 스크롤
  useEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollTop = 0
  }, [sessionEvents.length])

  const hasSessionData = sessionEvents.length > 0

  // 도구 바 차트 데이터
  const toolChartData = recentTools.map(([name, count]) => ({ name, count }))

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: C.bg }}>
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: hasSessionData ? '#29A634' : '#D1980B' }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: hasSessionData ? '#29A634' : '#D1980B' }} />
          </span>
          <h1 className="text-sm font-bold" style={{ color: C.text }}>Live Session Monitor</h1>
          {sessionId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: C.cardSub, color: C.textWeak }}>
              {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
        <button
          onClick={clearEvents}
          className="text-[11px] px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: C.cardSub, color: C.textWeak, border: `1px solid ${C.border}` }}
        >
          초기화
        </button>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌: 이벤트 타임라인 (65%) */}
        <div className="w-[65%] flex flex-col" style={{ borderRight: `1px solid ${C.border}` }}>
          <div ref={timelineRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {hasSessionData ? (
              sessionEvents.map((ev, i) => (
                <EventRow key={`${ev.id}-${i}`} event={ev} />
              ))
            ) : fileEvents.length > 0 ? (
              <div className="p-4">
                <p className="text-xs mb-3" style={{ color: C.textWeak }}>
                  세션 이벤트 대기 중... (파일 변경 이벤트 표시)
                </p>
                {fileEvents.map((ev, i) => (
                  <div key={`file-${ev.timestamp}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="text-[10px]" style={{ color: ev.type === 'add' ? '#29A634' : ev.type === 'change' ? '#D1980B' : '#DB2C6F' }}>
                      {ev.type === 'add' ? '+' : ev.type === 'change' ? '~' : '-'}
                    </span>
                    <span className="text-[11px] font-mono truncate" style={{ color: C.textSub }}>{ev.path}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-2xl mb-2" style={{ color: C.textDim }}>&#9673;</div>
                  <p className="text-sm" style={{ color: C.textWeak }}>세션 이벤트를 기다리는 중...</p>
                  <p className="text-[10px] mt-1" style={{ color: C.textDim }}>Claude Code 세션이 시작되면 실시간으로 표시됩니다</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우: 통계 패널 (35%) */}
        <div className="w-[35%] overflow-y-auto p-4 space-y-5">
          {/* 실시간 통계 */}
          <div>
            <h3 className="text-xs font-semibold mb-3" style={{ color: C.textWeak }}>실시간 통계</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="사용자" count={stats.user} color="#2D72D2" />
              <StatCard label="AI 응답" count={stats.assistant} color="#7961DB" />
              <StatCard label="도구 호출" count={stats.tool_use} color="#00A396" />
              <StatCard label="훅 실행" count={stats.hook} color="#29A634" />
              <StatCard label="에이전트" count={stats.agent_spawn} color="#D1980B" />
              <StatCard label="시스템" count={stats.system} color="#738091" />
            </div>
          </div>

          {/* 활성 에이전트 */}
          <div>
            <h3 className="text-xs font-semibold mb-2" style={{ color: C.textWeak }}>
              활성 에이전트 ({activeAgents.length})
            </h3>
            {activeAgents.length === 0 ? (
              <p className="text-[11px]" style={{ color: C.textDim }}>에이전트 활동 없음</p>
            ) : (
              <div className="space-y-1.5">
                {activeAgents.map((agent) => {
                  const isRecent = Date.now() - new Date(agent.lastSeen).getTime() < 30000
                  return (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ backgroundColor: C.cardSub }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                          {isRecent && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#D1980B' }} />
                          )}
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: isRecent ? '#D1980B' : C.textDim }} />
                        </span>
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono truncate block" style={{ color: C.textSub }}>
                            {agent.name.slice(0, 30)}
                          </span>
                          {agent.lastTool && (
                            <span className="text-[9px] font-mono" style={{ color: C.textDim }}>
                              ⚙ {agent.lastTool}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px]" style={{ color: C.textDim }}>{agent.eventCount}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 도구 사용 빈도 */}
          <div>
            <h3 className="text-xs font-semibold mb-2" style={{ color: C.textWeak }}>도구 사용 빈도</h3>
            {toolChartData.length === 0 ? (
              <p className="text-[11px]" style={{ color: C.textDim }}>도구 사용 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, toolChartData.length * 24)}>
                <BarChart data={toolChartData} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10, fill: C.textWeak }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {toolChartData.map((_, i) => (
                      <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 총 이벤트 */}
          <div className="rounded-lg p-3" style={{ backgroundColor: C.cardSub }}>
            <p className="text-[10px]" style={{ color: C.textWeak }}>총 이벤트</p>
            <p className="text-2xl font-bold" style={{ color: C.text }}>{sessionEvents.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
