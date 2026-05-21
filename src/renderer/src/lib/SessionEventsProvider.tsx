// 세션 이벤트 전역 Provider
// features/live-monitor/use-session-events.ts의 로직을 lib 계층으로 승격.
// LiveMonitor와 agent-office가 동일한 이벤트 스트림을 공유한다.
//
// Context value는 반드시 useMemo로 메모이즈 (React best practice `rerender-memo`).
// 인라인 객체를 쓰면 매 렌더마다 새 참조가 생겨 모든 consumer가 리렌더된다.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { SessionEvent } from './types'
import { api } from './api'

const MAX_EVENTS = 200

interface ActiveAgent {
  id: string
  name: string
  lastSeen: string
  eventCount: number
  lastTool?: string
}

interface SessionStats {
  user: number
  assistant: number
  tool_use: number
  hook: number
  agent_spawn: number
  agent_progress: number
  system: number
}

// agent-office용 활동 맵 엔트리
export interface AgentActivity {
  lastSeen: number // epoch ms
  lastTool?: string
  eventCount: number
}

interface SessionEventsContextValue {
  events: SessionEvent[]
  sessionId: string | null
  clearEvents: () => void
  activeAgents: ActiveAgent[]
  stats: SessionStats
  recentTools: Array<[string, number]>
  agentActivityMap: Map<string, AgentActivity>
}

const SessionEventsContext = createContext<SessionEventsContextValue | null>(null)

export function SessionEventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const unlistenEventRef = useRef<UnlistenFn | null>(null)
  const unlistenIdRef = useRef<UnlistenFn | null>(null)

  const handleEvent = useCallback((ev: unknown) => {
    // 디버그: 이벤트 수신 로그 (DevTools 콘솔에서 stream 확인용)
    // 활성화: window.__CC_DEBUG_SESSION = true
    if (
      typeof window !== 'undefined' &&
      (window as unknown as Record<string, unknown>).__CC_DEBUG_SESSION
    ) {
      // eslint-disable-next-line no-console
      console.log('[SessionEvent]', ev)
    }
    setEvents((prev) => {
      const next = [ev as SessionEvent, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    api.onSessionEvent(handleEvent).then((unlisten) => {
      unlistenEventRef.current = unlisten
    })
    api.onSessionId((id: string) => setSessionId(id)).then((unlisten) => {
      unlistenIdRef.current = unlisten
    })

    return () => {
      unlistenEventRef.current?.()
      unlistenIdRef.current?.()
    }
  }, [handleEvent])

  const clearEvents = useCallback(() => setEvents([]), [])

  const activeAgents = useMemo((): ActiveAgent[] => {
    const agents = new Map<string, ActiveAgent>()
    for (const ev of events) {
      if ((ev.type === 'agent_spawn' || ev.type === 'agent_progress') && ev.data.agentId) {
        const existing = agents.get(ev.data.agentId)
        if (existing) {
          existing.eventCount++
          if (ev.timestamp > existing.lastSeen) existing.lastSeen = ev.timestamp
        } else {
          agents.set(ev.data.agentId, {
            id: ev.data.agentId,
            name:
              ev.data.agentName && ev.data.agentName.length < 40
                ? ev.data.agentName
                : ev.data.agentId?.slice(0, 12) || 'unknown',
            lastSeen: ev.timestamp,
            eventCount: 1,
          })
        }
      }
      if (ev.type === 'tool_use' && ev.data.agentId) {
        const existing = agents.get(ev.data.agentId)
        if (existing) {
          existing.eventCount++
          existing.lastTool = ev.data.toolName
          if (ev.timestamp > existing.lastSeen) existing.lastSeen = ev.timestamp
        } else {
          agents.set(ev.data.agentId, {
            id: ev.data.agentId,
            name: ev.data.agentName || ev.data.agentId.slice(0, 12),
            lastSeen: ev.timestamp,
            eventCount: 1,
            lastTool: ev.data.toolName,
          })
        }
      }
    }
    return Array.from(agents.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
  }, [events])

  const stats = useMemo((): SessionStats => {
    const counts: SessionStats = {
      user: 0,
      assistant: 0,
      tool_use: 0,
      hook: 0,
      agent_spawn: 0,
      agent_progress: 0,
      system: 0,
    }
    for (const ev of events) {
      const key = ev.type as keyof SessionStats
      if (key in counts) counts[key]++
    }
    return counts
  }, [events])

  const recentTools = useMemo((): Array<[string, number]> => {
    const tools: Record<string, number> = {}
    for (const ev of events) {
      if (ev.data.toolName) {
        tools[ev.data.toolName] = (tools[ev.data.toolName] || 0) + 1
      }
      if (ev.type === 'hook' && ev.data.hookName) {
        tools[`hook:${ev.data.hookName}`] = (tools[`hook:${ev.data.hookName}`] || 0) + 1
      }
    }
    return Object.entries(tools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [events])

  // agent-office가 소비하는 활동 맵.
  // 키: agentId, 값: { lastSeen(epoch ms), lastTool?, eventCount }
  // agent_spawn/agent_progress/tool_use에서 agentId가 있는 이벤트만 반영.
  const agentActivityMap = useMemo((): Map<string, AgentActivity> => {
    const map = new Map<string, AgentActivity>()
    for (const ev of events) {
      const agentId = ev.data.agentId
      if (!agentId) continue
      const ts = Date.parse(ev.timestamp)
      if (Number.isNaN(ts)) continue
      const existing = map.get(agentId)
      if (existing) {
        existing.eventCount++
        if (ts > existing.lastSeen) {
          existing.lastSeen = ts
          if (ev.data.toolName) existing.lastTool = ev.data.toolName
        }
      } else {
        map.set(agentId, {
          lastSeen: ts,
          lastTool: ev.data.toolName,
          eventCount: 1,
        })
      }
    }
    return map
  }, [events])

  // Context value 메모이즈 — 인라인 객체 사용 시 모든 consumer 리렌더 폭탄
  const contextValue = useMemo<SessionEventsContextValue>(
    () => ({
      events,
      sessionId,
      clearEvents,
      activeAgents,
      stats,
      recentTools,
      agentActivityMap,
    }),
    [events, sessionId, clearEvents, activeAgents, stats, recentTools, agentActivityMap]
  )

  return (
    <SessionEventsContext.Provider value={contextValue}>
      {children}
    </SessionEventsContext.Provider>
  )
}

export function useSessionEventsContext(): SessionEventsContextValue {
  const ctx = useContext(SessionEventsContext)
  if (!ctx) {
    throw new Error('useSessionEventsContext must be used within SessionEventsProvider')
  }
  return ctx
}
