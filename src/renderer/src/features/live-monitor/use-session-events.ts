import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SessionEvent } from '../../lib/types'
import { api } from '../../lib/api'
import type { UnlistenFn } from '@tauri-apps/api/event'

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

export function useSessionEvents() {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const unlistenEventRef = useRef<UnlistenFn | null>(null)
  const unlistenIdRef = useRef<UnlistenFn | null>(null)

  const handleEvent = useCallback((ev: unknown) => {
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
            name: ev.data.agentName && ev.data.agentName.length < 40
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
    const counts: SessionStats = { user: 0, assistant: 0, tool_use: 0, hook: 0, agent_spawn: 0, agent_progress: 0, system: 0 }
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
    return Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [events])

  return { events, sessionId, clearEvents, activeAgents, stats, recentTools }
}
