import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStatsDiff } from '../../src/renderer/src/lib/hooks/use-stats-diff'

const STORAGE_KEY = 'cc-visualizer:last-stats'

type Stats = {
  agentCount: number
  skillCount: number
  hookCount: number
  ruleCount: number
  pipelineCount: number
  mcpServerCount: number
}

const baseStats: Stats = {
  agentCount: 99,
  skillCount: 162,
  hookCount: 97,
  ruleCount: 49,
  pipelineCount: 18,
  mcpServerCount: 47
}

describe('useStatsDiff', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('1: 최초 호출 (localStorage 비어있음) → diff 모두 0', () => {
    const { result } = renderHook(() => useStatsDiff(baseStats))
    expect(result.current.agentCount).toBe(0)
    expect(result.current.skillCount).toBe(0)
    expect(result.current.totalDiff).toBe(0)
  })

  it('2: 동일한 stats 두 번 → diff 모두 0', () => {
    renderHook(() => useStatsDiff(baseStats))
    const { result } = renderHook(() => useStatsDiff(baseStats))
    expect(result.current.totalDiff).toBe(0)
  })

  it('3: agent +102 변화 감지', () => {
    renderHook(() => useStatsDiff(baseStats))
    const newStats: Stats = { ...baseStats, agentCount: 201 }
    const { result } = renderHook(() => useStatsDiff(newStats))
    expect(result.current.agentCount).toBe(102)
    expect(result.current.totalDiff).toBe(102)
  })

  it('4: 음수 변화 감지 (skills 162 → 150 = -12)', () => {
    renderHook(() => useStatsDiff(baseStats))
    const newStats: Stats = { ...baseStats, skillCount: 150 }
    const { result } = renderHook(() => useStatsDiff(newStats))
    expect(result.current.skillCount).toBe(-12)
  })

  it('5: 복합 변화 (agent +102, rules +6)', () => {
    renderHook(() => useStatsDiff(baseStats))
    const newStats: Stats = { ...baseStats, agentCount: 201, ruleCount: 55 }
    const { result } = renderHook(() => useStatsDiff(newStats))
    expect(result.current.agentCount).toBe(102)
    expect(result.current.ruleCount).toBe(6)
    expect(result.current.totalDiff).toBe(108)
  })

  it('6: localStorage 손상 (JSON parse 실패) → 안전하게 diff 0 반환', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{')
    const { result } = renderHook(() => useStatsDiff(baseStats))
    expect(result.current.totalDiff).toBe(0)
  })
})
