import { useState, useEffect, useCallback, useRef } from 'react'
import type { FileChangeEvent } from '../../lib/types'

const MAX_EVENTS = 100

export function useFileWatcher() {
  const [events, setEvents] = useState<FileChangeEvent[]>([])
  const listenerAttached = useRef(false)

  const handleEvent = useCallback((data: { path: string; type: string }) => {
    const event: FileChangeEvent = {
      path: data.path,
      type: data.type as FileChangeEvent['type'],
      timestamp: Date.now(),
    }
    setEvents((prev) => {
      const next = [event, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    if (listenerAttached.current) return
    listenerAttached.current = true
    window.electronAPI.onFileChanged(handleEvent)

    return () => {
      window.electronAPI.removeFileChangedListener()
      listenerAttached.current = false
    }
  }, [handleEvent])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, clearEvents }
}
