import { useEffect, useRef, useState } from 'react'

// 이전 스캔 stats를 localStorage에 보관 → 새 스캔과 diff 계산.
// 사용자에게 "이번 새로고침에서 +N 증가" 시각 후킹 제공.
type Stats = {
  agentCount: number
  skillCount: number
  hookCount: number
  ruleCount: number
  pipelineCount: number
  mcpServerCount: number
}

type StatsDiff = Stats & { totalDiff: number }

const STORAGE_KEY = 'cc-visualizer:last-stats'

const ZERO_DIFF: StatsDiff = {
  agentCount: 0,
  skillCount: 0,
  hookCount: 0,
  ruleCount: 0,
  pipelineCount: 0,
  mcpServerCount: 0,
  totalDiff: 0
}

function readStored(): Stats | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Stats
  } catch {
    return null
  }
}

function writeStored(stats: Stats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // localStorage 쓰기 실패 (quota 초과 등) — 조용히 무시
  }
}

function computeDiff(prev: Stats, next: Stats): StatsDiff {
  const agentCount = next.agentCount - prev.agentCount
  const skillCount = next.skillCount - prev.skillCount
  const hookCount = next.hookCount - prev.hookCount
  const ruleCount = next.ruleCount - prev.ruleCount
  const pipelineCount = next.pipelineCount - prev.pipelineCount
  const mcpServerCount = next.mcpServerCount - prev.mcpServerCount
  const totalDiff =
    agentCount + skillCount + hookCount + ruleCount + pipelineCount + mcpServerCount
  return {
    agentCount,
    skillCount,
    hookCount,
    ruleCount,
    pipelineCount,
    mcpServerCount,
    totalDiff
  }
}

// 첫 마운트 시 stored와 비교한 diff를 즉시 반환 — 시각 후킹의 핵심.
// StrictMode 중복 마운트 + currentStats prop 변경(refreshSystem)을 ref로 분리 처리.
//   - 첫 mount: init function에서 diff 계산. stored는 건드리지 않음 (다음 reload 시도 같은 diff 유지).
//   - currentStats 변경 (refreshSystem 결과): useEffect에서 새 diff + stored 갱신.
export function useStatsDiff(currentStats: Stats): StatsDiff {
  const [diff, setDiff] = useState<StatsDiff>(() => {
    const prev = readStored()
    if (!prev) {
      writeStored(currentStats)
      return ZERO_DIFF
    }
    return computeDiff(prev, currentStats)
  })

  // strict mode 중복 호출 방어 — 마지막으로 본 currentStats snapshot 비교
  const lastSeenRef = useRef<string | null>(null)
  useEffect(() => {
    const snapshot = JSON.stringify(currentStats)
    if (lastSeenRef.current === null) {
      // 첫 effect — init function에서 이미 처리됨, snapshot만 기록
      lastSeenRef.current = snapshot
      return
    }
    if (lastSeenRef.current === snapshot) return // 동일 stats 재호출 skip
    lastSeenRef.current = snapshot

    // 실제 stats 변경 (refreshSystem) — 새 diff + stored 갱신
    const prev = readStored()
    if (!prev) {
      writeStored(currentStats)
      setDiff(ZERO_DIFF)
      return
    }
    const next = computeDiff(prev, currentStats)
    setDiff(next)
    writeStored(currentStats)
  }, [currentStats])

  return diff
}
