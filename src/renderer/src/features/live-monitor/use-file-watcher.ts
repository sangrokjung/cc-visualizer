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
    api.onFileChanged(handleEvent).then((unlisten) => {
      unlistenRef.current = unlisten
    })

    return () => {
      unlistenRef.current?.()
    }
  }, [handleEvent])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, clearEvents }
}
