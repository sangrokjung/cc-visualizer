import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// useSessionEventsContext를 모킹하여 charCount → 토큰 → 비용 end-to-end 검증
// (실제 Tauri IPC 없이 useTokenFlow의 집계 로직을 통합 검증)
const mockEvents = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('../../src/renderer/src/lib/SessionEventsProvider', () => ({
  useSessionEventsContext: () => ({
    events: mockEvents.value,
    sessionId: 'test-session',
    clearEvents: () => {},
    activeAgents: [],
    stats: { user: 0, assistant: 0, tool_use: 0, hook: 0, agent_spawn: 0, agent_progress: 0, system: 0 },
    recentTools: [],
    agentActivityMap: new Map()
  })
}))

import { useTokenFlow } from '../../src/renderer/src/lib/hooks/use-token-flow'

function ev(type: string, charCount: number, tsOffset = 0) {
  return {
    id: `${type}-${charCount}-${tsOffset}`,
    timestamp: new Date(Date.now() + tsOffset).toISOString(),
    type,
    data: { charCount }
  }
}

describe('useTokenFlow integration (charCount → cost)', () => {
  beforeEach(() => {
    mockEvents.value = []
  })

  it('1: 빈 이벤트 → 비용 0', () => {
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.totalCostUsd).toBe(0)
    expect(result.current.totalInputTokens).toBe(0)
  })

  it('2: user charCount 4000 → input 1000 토큰', () => {
    mockEvents.value = [ev('user', 4000)]
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.totalInputTokens).toBe(1000)
  })

  it('3: assistant charCount 4000 → output 1000 토큰', () => {
    mockEvents.value = [ev('assistant', 4000)]
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.totalOutputTokens).toBe(1000)
  })

  it('4: tool_use는 output으로 집계', () => {
    mockEvents.value = [ev('tool_use', 4000)]
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.totalOutputTokens).toBe(1000)
  })

  it('5: 복합 — input 100K tok + output 50K tok → $1.05', () => {
    // input 100K tokens = 400K chars, output 50K tokens = 200K chars
    mockEvents.value = [ev('user', 400_000), ev('assistant', 200_000)]
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.totalInputTokens).toBe(100_000)
    expect(result.current.totalOutputTokens).toBe(50_000)
    expect(result.current.totalCostUsd).toBeCloseTo(1.05, 3)
  })

  it('6: recentSamples는 최근 20개로 제한', () => {
    mockEvents.value = Array.from({ length: 30 }, (_, i) => ev('user', 400, i))
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.recentSamples.length).toBe(20)
    expect(result.current.samples.length).toBe(30)
  })

  it('7: charCount 0인 이벤트는 스킵', () => {
    mockEvents.value = [ev('user', 0), ev('user', 4000)]
    const { result } = renderHook(() => useTokenFlow())
    expect(result.current.samples.length).toBe(1)
  })
})
