import { useEffect, useRef, useState } from 'react'
import type { AgentStatus } from './office-config'

// 접근성: 상태 변경 요약을 3초 디바운스로 라이브 리전에 알림.
// 99명 동시 변경 시 개별 알림 금지 (스크린 리더 폭탄 방지).
export function useLiveRegion(statuses: Map<string, AgentStatus>): string {
  const [announcement, setAnnouncement] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      let working = 0, recent = 0, idle = 0, offline = 0
      for (const s of statuses.values()) {
        if (s === 'working') working++
        else if (s === 'recent') recent++
        else if (s === 'idle') idle++
        else offline++
      }
      if (statuses.size > 0) {
        setAnnouncement(
          `에이전트 현황: ${working}명 작업 중, ${recent}명 방금 활동, ${idle}명 대기, ${offline}명 오프라인`
        )
      }
    }, 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [statuses])

  return announcement
}
