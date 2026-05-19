import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'

// api mock — onClaudeSystemChanged 콜백을 저장해 테스트 내에서 수동 호출
type SystemChangedCb = () => void
let systemChangedCallback: SystemChangedCb | null = null
let unlistenCalled = false

vi.mock('../../src/renderer/src/lib/api', () => ({
  api: {
    loadSystemData: vi.fn(() => Promise.resolve(null)),
    loadUsageData: vi.fn(() => Promise.resolve(null)),
    loadExternalSystems: vi.fn(() => Promise.resolve(null)),
    rescanSystem: vi.fn(() => Promise.resolve({ ok: true })),
    rescanUsage: vi.fn(() => Promise.resolve({ ok: true })),
    onClaudeSystemChanged: vi.fn((cb: SystemChangedCb) => {
      systemChangedCallback = cb
      return Promise.resolve(() => {
        unlistenCalled = true
        systemChangedCallback = null
      })
    }),
  },
}))

// 정적 JSON import mock
vi.mock('../../src/renderer/src/data/system-data.json', () => ({
  default: { agents: [], skills: [], hooks: [], rules: [], pipelines: [], mcpServers: [] },
}))
vi.mock('../../src/renderer/src/data/usage-stats.json', () => ({
  default: {},
}))
vi.mock('../../src/renderer/src/data/external-systems.json', () => ({
  default: [],
}))

import { DataProvider, useSystemDataContext } from '../../src/renderer/src/lib/DataProvider'
import { api } from '../../src/renderer/src/lib/api'

function wrapper({ children }: { children: ReactNode }) {
  return <DataProvider>{children}</DataProvider>
}

describe('DataProvider — claude-system-changed 이벤트 자동 rescan', () => {
  beforeEach(() => {
    systemChangedCallback = null
    unlistenCalled = false
    vi.clearAllMocks()
    // 기본 mock 재설정
    vi.mocked(api.loadSystemData).mockResolvedValue(null)
    vi.mocked(api.loadUsageData).mockResolvedValue(null)
    vi.mocked(api.loadExternalSystems).mockResolvedValue(null)
    vi.mocked(api.rescanSystem).mockResolvedValue({ ok: true })
    vi.mocked(api.onClaudeSystemChanged).mockImplementation((cb: SystemChangedCb) => {
      systemChangedCallback = cb
      return Promise.resolve(() => {
        unlistenCalled = true
        systemChangedCallback = null
      })
    })
  })

  it('마운트 시 onClaudeSystemChanged 리스너가 등록된다', async () => {
    renderHook(() => useSystemDataContext(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })

    expect(api.onClaudeSystemChanged).toHaveBeenCalledTimes(1)
  })

  it('claude-system-changed 이벤트 발생 시 rescanSystem이 호출된다', async () => {
    renderHook(() => useSystemDataContext(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })

    expect(systemChangedCallback).not.toBeNull()

    await act(async () => {
      systemChangedCallback?.()
      await Promise.resolve()
    })

    expect(api.rescanSystem).toHaveBeenCalled()
  })

  it('언마운트 시 unlisten이 호출된다', async () => {
    const { unmount } = renderHook(() => useSystemDataContext(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    // unlisten은 비동기로 등록되므로 한 틱 기다림
    await act(async () => {
      await Promise.resolve()
    })

    expect(unlistenCalled).toBe(true)
  })
})
