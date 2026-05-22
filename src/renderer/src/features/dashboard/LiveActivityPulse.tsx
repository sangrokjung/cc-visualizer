import { memo, useMemo, useEffect, useState } from 'react'
import { useSessionEventsContext } from '../../lib/SessionEventsProvider'

// 라이브 Claude Code 활동 시각화 — 메모리/CPU 가벼움 우선
// - push 기반 (polling 0회) — SessionEventsProvider가 Rust tail로 자동 stream
// - DOM 노드 최대 ~25 (recent events 5 + tool top 3 + stat 4)
// - 애니메이션은 opacity transition + animate-pulse (transform layer 없음)
// - currentTime은 1초가 아닌 5초 tick (상대 시각 표시용)

// 이벤트 종류별 색상 + 아이콘
const EVENT_META: Record<string, { color: string; icon: string; label: string }> = {
  user: { color: '#2D72D2', icon: '◆', label: 'User' },
  assistant: { color: '#7961DB', icon: '◇', label: 'Assistant' },
  tool_use: { color: '#D1980B', icon: '⚙', label: 'Tool' },
  hook: { color: '#29A634', icon: '⟁', label: 'Hook' },
  agent_spawn: { color: '#D33D17', icon: '★', label: 'Agent Spawn' },
  agent_progress: { color: '#00A396', icon: '↻', label: 'Agent Progress' },
  system: { color: '#5F6B7C', icon: '·', label: 'System' }
}

function relativeTime(iso: string, nowMs: number): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return ''
  const diff = nowMs - ts
  if (diff < 5_000) return '방금'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}초 전`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  return `${Math.floor(diff / 86_400_000)}일 전`
}

// 활동 막대 — 도구 사용 빈도 mini bar
const ToolBar = memo(function ToolBar({
  name,
  count,
  max,
  color
}: {
  name: string
  count: number
  max: number
  color: string
}) {
  const widthPct = max === 0 ? 0 : (count / max) * 100
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] tabular-nums w-32 truncate"
        style={{ color: '#ABB3BF' }}
        title={name}
      >
        {name}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(64, 72, 84, 0.4)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${widthPct}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}99`
          }}
        />
      </div>
      <span
        className="text-[10px] tabular-nums w-6 text-right"
        style={{ color: '#F6F7F9' }}
      >
        {count}
      </span>
    </div>
  )
})

// 활성 펄스 인디케이터 — 마지막 이벤트 기준 active/idle 표시
function LivePulse({ active }: { active: boolean }) {
  const color = active ? '#29A634' : '#5F6B7C'
  return (
    <span className="relative flex h-2 w-2">
      {active && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

export const LiveActivityPulse = memo(function LiveActivityPulse() {
  const { events, stats, recentTools, sessionId, activeAgents } = useSessionEventsContext()

  // 5초 tick — 상대 시각 갱신 (1초 tick은 리렌더 폭탄)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  // 최근 5개 이벤트만 (DOM 노드 제한)
  const recentEvents = useMemo(() => events.slice(0, 5), [events])

  // flash 키 — 새 이벤트 도착 시 변경되어 CSS 애니메이션 재트리거
  // Yuyz0112(2366★) flash 패턴 영감 (yellow → transparent 1초)
  const flashKey = events[0]?.id ?? 'empty'

  // active 판정: 마지막 이벤트가 30초 이내
  const isActive = useMemo(() => {
    if (events.length === 0) return false
    const lastTs = Date.parse(events[0].timestamp)
    return !Number.isNaN(lastTs) && nowMs - lastTs < 30_000
  }, [events, nowMs])

  const totalEvents = events.length
  const toolMax = recentTools.length > 0 ? recentTools[0][1] : 0

  return (
    <div
      className="rounded-2xl p-5 border overflow-hidden relative"
      style={{
        backgroundColor: '#1C2127',
        borderColor: isActive ? 'rgba(41, 166, 52, 0.4)' : '#404854',
        boxShadow: isActive ? '0 0 24px rgba(41, 166, 52, 0.15)' : 'none',
        transition: 'box-shadow 600ms ease, border-color 600ms ease'
      }}
    >
      {/* 헤더: 라이브 상태 + 세션 ID */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LivePulse active={isActive} />
          <h3 className="text-sm font-semibold" style={{ color: '#F6F7F9' }}>
            Live Activity
          </h3>
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: isActive ? '#29A634' : '#5F6B7C' }}
          >
            {isActive ? 'streaming' : 'idle'}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: '#738091' }}>
          {sessionId ? sessionId.slice(0, 8) : 'no-session'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 좌측: 이벤트 종류별 미니 카운터 */}
        <div>
          <p
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: '#5F6B7C' }}
          >
            세션 이벤트 ({totalEvents})
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['user', 'assistant', 'tool_use', 'hook'] as const).map((key) => {
              const meta = EVENT_META[key]
              const count = stats[key]
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-2 py-1 rounded"
                  style={{
                    backgroundColor: `${meta.color}14`,
                    border: `1px solid ${meta.color}33`
                  }}
                >
                  <span style={{ color: meta.color }} className="text-xs">
                    {meta.icon}
                  </span>
                  <span
                    className="text-[10px] flex-1 truncate"
                    style={{ color: '#ABB3BF' }}
                  >
                    {meta.label}
                  </span>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: count > 0 ? '#F6F7F9' : '#5F6B7C' }}
                  >
                    {count}
                  </span>
                </div>
              )
            })}
          </div>

          {/* 활성 에이전트 수 */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#5F6B7C' }}>
              활성 에이전트
            </span>
            <span className="text-base font-bold tabular-nums" style={{ color: '#F6F7F9' }}>
              {activeAgents.length}
            </span>
          </div>
        </div>

        {/* 우측: 도구 사용 빈도 Top 3 + 최근 이벤트 */}
        <div>
          <p
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: '#5F6B7C' }}
          >
            Top Tools
          </p>
          {recentTools.length === 0 ? (
            <p className="text-[10px]" style={{ color: '#5F6B7C' }}>
              데이터 수집 중...
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentTools.slice(0, 3).map(([name, count]) => (
                <ToolBar
                  key={name}
                  name={name}
                  count={count}
                  max={toolMax}
                  color="#D1980B"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 하단: 최근 이벤트 5개 (DOM 노드 제한) */}
      {recentEvents.length > 0 && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: '#252A31' }}>
          <p
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: '#5F6B7C' }}
          >
            최근 이벤트
          </p>
          <ul className="space-y-1">
            {recentEvents.map((ev, idx) => {
              const meta = EVENT_META[ev.type] ?? EVENT_META.system
              const label =
                ev.data.toolName ??
                ev.data.hookName ??
                ev.data.agentName ??
                ev.data.text?.slice(0, 60) ??
                meta.label
              // 최신 이벤트(idx=0)만 flash 애니메이션 — Yuyz0112 패턴
              const isLatest = idx === 0
              return (
                <li
                  key={`${flashKey}-${ev.id}`}
                  className={`flex items-center gap-2 text-[11px] px-1.5 py-0.5 rounded ${
                    isLatest ? 'animate-flash-once' : ''
                  }`}
                  style={{ color: '#ABB3BF' }}
                >
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <span className="flex-1 truncate" title={label}>
                    {label}
                  </span>
                  <span className="text-[10px]" style={{ color: '#5F6B7C' }}>
                    {relativeTime(ev.timestamp, nowMs)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Yuyz0112 영감 flash 애니메이션 — 새 이벤트 도착 시 1초 노란 깜박 → fade */}
      <style>{`
        @keyframes flash-once {
          0% { background-color: rgba(255, 217, 102, 0.45); }
          100% { background-color: transparent; }
        }
        .animate-flash-once {
          animation: flash-once 1s ease-out;
        }
      `}</style>
    </div>
  )
})
