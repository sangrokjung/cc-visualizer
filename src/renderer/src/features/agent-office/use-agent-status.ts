// 에이전트 상태 훅
// 세션 이벤트 기반 실데이터 매칭. 세션 이벤트가 없으면 DEMO MODE(랜덤)로 fallback.
//
// 상태 임계값:
//   - working: lastSeen 30초 이내
//   - recent:  lastSeen 5분 이내
//   - idle:    그 외 (세션 이벤트는 있지만 오래됨)
//   - offline: 세션 이벤트 전혀 없음

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSessionEventsContext } from '../../lib/SessionEventsProvider'
import type { AgentStatus } from './office-config'

const WORKING_THRESHOLD_MS = 30_000
const RECENT_THRESHOLD_MS = 5 * 60_000
const TICK_INTERVAL_MS = 5_000

// DEMO MODE: 세션 이벤트 0건일 때 Math.random 기반 fallback
// 실시간 활성화 강화 (2026-05-21) — 갱신 주기 단축 4-9초로 시각적 활기 증대
const DEMO_MIN_DELAY_MS = 4_000
const DEMO_MAX_DELAY_MS = 9_000

interface UseAgentStatusesResult {
  statuses: Map<string, AgentStatus>
  demoMode: boolean
}

function pickRandomDemoStatus(): AgentStatus {
  const roll = Math.random()
  if (roll < 0.6) return 'working'
  if (roll < 0.85) return 'recent'
  return 'idle'
}

function buildDemoMap(agentIds: string[]): Map<string, AgentStatus> {
  const map = new Map<string, AgentStatus>()
  for (const id of agentIds) map.set(id, pickRandomDemoStatus())
  return map
}

export function useAgentStatuses(agentIds: string[]): UseAgentStatusesResult {
  const { agentActivityMap } = useSessionEventsContext()
  const [tick, setTick] = useState(0)

  // agentIds 참조 안정화 — 호출 측에서 인라인 배열을 넘겨도 내용이 같으면 재실행 방지
  const agentIdsKey = agentIds.join('|')

  // 5초마다 재평가 (working → recent → idle 자연 전이)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const demoMode = agentActivityMap.size === 0

  // DEMO MODE fallback용 랜덤 상태 (8~15초 주기 재할당)
  const [demoStatuses, setDemoStatuses] = useState<Map<string, AgentStatus>>(() =>
    buildDemoMap(agentIds)
  )
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 최신 agentIds를 ref로 보관 (타이머 클로저에서 사용)
  const latestAgentIdsRef = useRef(agentIds)
  latestAgentIdsRef.current = agentIds

  useEffect(() => {
    if (!demoMode) {
      if (demoTimerRef.current) {
        clearTimeout(demoTimerRef.current)
        demoTimerRef.current = null
      }
      return
    }

    let cancelled = false
    function schedule() {
      const delay = DEMO_MIN_DELAY_MS + Math.random() * (DEMO_MAX_DELAY_MS - DEMO_MIN_DELAY_MS)
      demoTimerRef.current = setTimeout(() => {
        if (cancelled) return
        setDemoStatuses(buildDemoMap(latestAgentIdsRef.current))
        schedule()
      }, delay)
    }
    // agentIds 집합이 바뀌었을 때만 즉시 재할당 (agentIdsKey 의존성으로 보장)
    setDemoStatuses(buildDemoMap(latestAgentIdsRef.current))
    schedule()

    return () => {
      cancelled = true
      if (demoTimerRef.current) {
        clearTimeout(demoTimerRef.current)
        demoTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, agentIdsKey])

  const statuses = useMemo((): Map<string, AgentStatus> => {
    if (demoMode) return demoStatuses

    // 실데이터 우선 + 실데이터 없는 에이전트는 DEMO 랜덤으로 보완 (Hybrid)
    // → 200개 카드 모두에 시각적 활기 유지 (사용자가 본 "작업중 안 보임" 해결)
    const now = Date.now()
    const out = new Map<string, AgentStatus>()
    for (const aid of agentIds) {
      const activity = agentActivityMap.get(aid)
      if (activity) {
        const elapsed = now - activity.lastSeen
        if (elapsed < WORKING_THRESHOLD_MS) out.set(aid, 'working')
        else if (elapsed < RECENT_THRESHOLD_MS) out.set(aid, 'recent')
        else out.set(aid, 'idle')
      } else {
        // 실데이터 없는 에이전트 — DEMO 보완으로 활기 유지
        out.set(aid, demoStatuses.get(aid) ?? 'offline')
      }
    }
    return out
    // agentIdsKey는 agentIds 참조 안정화용. tick은 시간 임계값 전이 트리거.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentIdsKey, agentActivityMap, demoMode, demoStatuses, tick])

  return { statuses, demoMode }
}
