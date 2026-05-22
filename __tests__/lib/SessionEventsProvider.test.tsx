import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'

// api mock — onSessionEvent 콜백을 저장해 테스트 내에서 수동 호출
type EventCb = (ev: unknown) => void
let eventCallback: EventCb | null = null
let sessionIdCallback: ((id: string) => void) | null = null

vi.mock('../../src/renderer/src/lib/api', () => ({
  api: {
    onSessionEvent: vi.fn((cb: EventCb) => {
      eventCallback = cb
      return Promise.resolve(() => {
        eventCallback = null
      })
    }),
    onSessionId: vi.fn((cb: (id: string) => void) => {
      sessionIdCallback = cb
      return Promise.resolve(() => {
        sessionIdCallback = null
      })
    }),
    // 테스트는 backfillSession을 stub만 — 실제 호출 안 됨
    backfillSession: vi.fn(() => Promise.resolve(0)),
  },
}))

import {
  SessionEventsProvider,
  useSessionEventsContext,
} from '../../src/renderer/src/lib/SessionEventsProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <SessionEventsProvider>{children}</SessionEventsProvider>
}

function makeEvent(overrides: {
  id?: string
  timestamp?: string
  type?: string
  data?: Record<string, unknown>
}) {
  return {
    id: overrides.id ?? 'ev-1',
    timestamp: overrides.timestamp ?? '2026-04-12T01:00:00.000Z',
    type: overrides.type ?? 'agent_spawn',
    data: overrides.data ?? { agentId: 'code-reviewer', agentName: 'Code Reviewer' },
  }
}

describe('SessionEventsProvider', () => {
  beforeEach(() => {
    eventCallback = null
    sessionIdCallback = null
    // SessionEventsProvider가 Tauri 환경에서만 listen 등록 — 테스트는 Tauri 환경 흉내
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  })

  it('Provider 없이 useSessionEventsContext 호출하면 에러를 던진다', () => {
    // @testing-library/react의 renderHook은 에러를 잡아주지 않으므로 try/catch
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useSessionEventsContext())
    }).toThrow(/must be used within SessionEventsProvider/)
    consoleErrorSpy.mockRestore()
  })

  it('초기 상태는 빈 이벤트 목록과 null sessionId', async () => {
    const { result } = renderHook(() => useSessionEventsContext(), { wrapper })
    // useEffect로 api.onSessionEvent 등록되는 것을 기다림
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.events).toEqual([])
    expect(result.current.sessionId).toBeNull()
    expect(result.current.agentActivityMap.size).toBe(0)
    expect(result.current.activeAgents).toEqual([])
  })

  it('agent_spawn 이벤트 주입 시 agentActivityMap에 반영된다', async () => {
    const { result } = renderHook(() => useSessionEventsContext(), { wrapper })
    await act(async () => {
      await Promise.resolve()
    })
    expect(eventCallback).not.toBeNull()

    const ev = makeEvent({
      timestamp: '2026-04-12T01:00:30.000Z',
      data: { agentId: 'planner', agentName: 'Planner' },
    })
    act(() => {
      eventCallback?.(ev)
    })

    const activity = result.current.agentActivityMap.get('planner')
    expect(activity).toBeDefined()
    expect(activity?.eventCount).toBe(1)
    expect(activity?.lastSeen).toBe(Date.parse('2026-04-12T01:00:30.000Z'))
  })

  it('동일 agentId의 더 최근 이벤트가 들어오면 lastSeen 갱신 + eventCount 증가', async () => {
    const { result } = renderHook(() => useSessionEventsContext(), { wrapper })
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      eventCallback?.(
        makeEvent({
          id: 'ev-1',
          timestamp: '2026-04-12T01:00:00.000Z',
          type: 'agent_spawn',
          data: { agentId: 'planner', agentName: 'Planner' },
        })
      )
      eventCallback?.(
        makeEvent({
          id: 'ev-2',
          timestamp: '2026-04-12T01:02:00.000Z',
          type: 'tool_use',
          data: { agentId: 'planner', toolName: 'Read' },
        })
      )
    })

    const activity = result.current.agentActivityMap.get('planner')
    expect(activity?.eventCount).toBe(2)
    expect(activity?.lastSeen).toBe(Date.parse('2026-04-12T01:02:00.000Z'))
    expect(activity?.lastTool).toBe('Read')
  })

  it('잘못된 timestamp(NaN) 이벤트는 agentActivityMap에서 제외된다', async () => {
    const { result } = renderHook(() => useSessionEventsContext(), { wrapper })
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      eventCallback?.(
        makeEvent({
          id: 'bad',
          timestamp: 'not-a-valid-date',
          data: { agentId: 'ghost', agentName: 'Ghost' },
        })
      )
    })

    expect(result.current.agentActivityMap.has('ghost')).toBe(false)
  })

  it('agentId 없는 이벤트는 agentActivityMap에서 제외된다', async () => {
    const { result } = renderHook(() => useSessionEventsContext(), { wrapper })
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      eventCallback?.(
        makeEvent({
          id: 'no-agent',
          type: 'user',
          data: { text: 'hello' },
        })
      )
    })

    expect(result.current.agentActivityMap.size).toBe(0)
  })

  it('Provider가 자식을 렌더링한다', () => {
    const { getByText } = render(
      <SessionEventsProvider>
        <span>child-content</span>
      </SessionEventsProvider>
    )
    expect(getByText('child-content')).toBeDefined()
  })
})
