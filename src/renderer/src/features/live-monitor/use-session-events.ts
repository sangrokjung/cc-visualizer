import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SessionEvent } from '../../lib/types'

const MAX_EVENTS = 200

interface ActiveAgent {
  id: string
  name: string
  lastSeen: string
  eventCount: number
}

interface SessionStats {
  user: number
  assistant: number
  tool_use: number
  hook: number
  agent_spawn: number
  system: number
}

export function useSessionEvents() {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const attached = useRef(false)

  const handleEvent = useCallback((ev: SessionEvent) => {
    setEvents((prev) => {
      const next = [ev, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    if (attached.current) return
    attached.current = true

    if (window.electronAPI?.onSessionEvent) {
      window.electronAPI.onSessionEvent(handleEvent)
    }
    if (window.electronAPI?.onSessionId) {
      window.electronAPI.onSessionId((id: string) => setSessionId(id))
    }

    return () => {
      if (window.electronAPI?.removeSessionEventListener) {
        window.electronAPI.removeSessionEventListener()
      }
      attached.current = false
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
            name: ev.data.agentName || ev.data.agentId.slice(0, 12),
            lastSeen: ev.timestamp,
            eventCount: 1,
          })
        }
      }
    }
    return Array.from(agents.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
  }, [events])

  const stats = useMemo((): SessionStats => {
    const counts: SessionStats = { user: 0, assistant: 0, tool_use: 0, hook: 0, agent_spawn: 0, system: 0 }
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
      // hook command도 도구처럼 표시
      if (ev.type === 'hook' && ev.data.hookName) {
        tools[`hook:${ev.data.hookName}`] = (tools[`hook:${ev.data.hookName}`] || 0) + 1
      }
    }
    return Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [events])

  return { events, sessionId, clearEvents, activeAgents, stats, recentTools }
}
