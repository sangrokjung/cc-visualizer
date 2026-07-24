import { useState, useEffect, useCallback, useRef } from 'react'
import type { FileChangeEvent } from '../../lib/types'
import { api } from '../../lib/api'
import type { UnlistenFn } from '@tauri-apps/api/event'

const MAX_EVENTS = 100

export function useFileWatcher() {
  const [events, setEvents] = useState<FileChangeEvent[]>([])
  const unlistenRef = useRef<UnlistenFn | null>(null)

  const handleEvent = useCallback((data: { path: string; type: string; timestamp: number }) => {
    const event: FileChangeEvent = {
      path: data.path,
      type: data.type as FileChangeEvent['type'],
      timestamp: data.timestamp || Date.now(),
    }
    setEvents((prev) => {
      const next = [event, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .onFileChanged(handleEvent)
      .then((unlisten) => {
        // 등록 도중 언마운트되면 즉시 unlisten (ref만 채우면 cleanup이 못 부름 → 리스너 누수)
        if (cancelled) {
          unlisten()
          return
        }
        unlistenRef.current = unlisten
      })
      .catch(() => {
        // 비-Tauri(Vite dev) 환경에서는 listen이 reject — 조용히 무시
      })

    return () => {
      cancelled = true
      unlistenRef.current?.()
    }
  }, [handleEvent])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, clearEvents }
}
