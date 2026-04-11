import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// vi.hoisted로 mock 상태를 공유 — mock 팩토리는 hoist되므로 일반 let 변수는 반영 안 됨
const mockState = vi.hoisted(() => ({
  activityMap: new Map<
    string,
    { lastSeen: number; lastTool?: string; eventCount: number }
  >(),
}))

vi.mock('@/lib/SessionEventsProvider', () => ({
  useSessionEventsContext: () => ({
    events: [],
    sessionId: null,
    clearEvents: vi.fn(),
    activeAgents: [],
    stats: {},
    recentTools: [],
    agentActivityMap: mockState.activityMap,
  }),
}))

import { useAgentStatuses } from '@/features/agent-office/use-agent-status'

const FIXED_NOW = Date.parse('2026-04-12T12:00:00.000Z')

// stable 참조 배열 — 인라인 생성 시 렌더마다 새 참조가 되어 useEffect 루프 유발
const AGENTS_SINGLE = ['agent-1']
const AGENTS_PAIR = ['agent-1', 'agent-2']
const AGENTS_MIXED = ['a', 'b', 'c', 'd']
const AGENTS_TRIO = ['agent-1', 'agent-2', 'agent-3']

describe('useAgentStatuses', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_NOW))
    mockState.activityMap = new Map()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('agentActivityMap이 비어 있으면 DEMO MODE 진입 + 상태 맵 채움', () => {
    const { result } = renderHook(() => useAgentStatuses(AGENTS_TRIO))
    expect(result.current.demoMode).toBe(true)
    expect(result.current.statuses.size).toBe(3)
    for (const id of AGENTS_TRIO) {
      const status = result.current.statuses.get(id)
      expect(['working', 'recent', 'idle']).toContain(status)
    }
  })

  it('lastSeen이 30초 이내면 working으로 판정', () => {
    mockState.activityMap = new Map([
      ['agent-1', { lastSeen: FIXED_NOW - 10_000, eventCount: 1 }],
    ])
    const { result } = renderHook(() => useAgentStatuses(AGENTS_SINGLE))
    expect(result.current.demoMode).toBe(false)
    expect(result.current.statuses.get('agent-1')).toBe('working')
  })

  it('lastSeen이 30초~5분 사이면 recent로 판정', () => {
    mockState.activityMap = new Map([
      ['agent-1', { lastSeen: FIXED_NOW - 60_000, eventCount: 1 }],
    ])
    const { result } = renderHook(() => useAgentStatuses(AGENTS_SINGLE))
    expect(result.current.statuses.get('agent-1')).toBe('recent')
  })

  it('lastSeen이 5분 초과면 idle로 판정', () => {
    mockState.activityMap = new Map([
      ['agent-1', { lastSeen: FIXED_NOW - 10 * 60_000, eventCount: 1 }],
    ])
    const { result } = renderHook(() => useAgentStatuses(AGENTS_SINGLE))
    expect(result.current.statuses.get('agent-1')).toBe('idle')
  })

  it('activityMap에 agentId가 없으면 offline으로 판정', () => {
    mockState.activityMap = new Map([
      ['agent-1', { lastSeen: FIXED_NOW - 5_000, eventCount: 1 }],
    ])
    const { result } = renderHook(() => useAgentStatuses(AGENTS_PAIR))
    expect(result.current.statuses.get('agent-1')).toBe('working')
    expect(result.current.statuses.get('agent-2')).toBe('offline')
  })

  it('5초 tick 경과 후 상태 재평가 (working → recent 자연 전이)', () => {
    mockState.activityMap = new Map([
      ['agent-1', { lastSeen: FIXED_NOW - 25_000, eventCount: 1 }],
    ])
    const { result } = renderHook(() => useAgentStatuses(AGENTS_SINGLE))
    expect(result.current.statuses.get('agent-1')).toBe('working')

    // 시스템 시간을 앞당김 → 이제 lastSeen과 차이가 35초 (working 임계 넘음)
    act(() => {
      vi.setSystemTime(new Date(FIXED_NOW + 10_000))
      vi.advanceTimersByTime(5_000)
    })

    expect(result.current.statuses.get('agent-1')).toBe('recent')
  })

  it('agentActivityMap에 다수 에이전트 상태 혼합', () => {
    mockState.activityMap = new Map([
      ['a', { lastSeen: FIXED_NOW - 10_000, eventCount: 1 }], // working
      ['b', { lastSeen: FIXED_NOW - 60_000, eventCount: 1 }], // recent
      ['c', { lastSeen: FIXED_NOW - 10 * 60_000, eventCount: 1 }], // idle
      // 'd' → offline
    ])
    const { result } = renderHook(() => useAgentStatuses(AGENTS_MIXED))
    expect(result.current.demoMode).toBe(false)
    expect(result.current.statuses.get('a')).toBe('working')
    expect(result.current.statuses.get('b')).toBe('recent')
    expect(result.current.statuses.get('c')).toBe('idle')
    expect(result.current.statuses.get('d')).toBe('offline')
  })
})
