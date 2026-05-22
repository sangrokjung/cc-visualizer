import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// api mock — onClaudeSystemChanged 콜백을 저장해 테스트 내에서 수동 호출
type SystemChangedCb = () => void
let systemChangedCallback: SystemChangedCb | null = null
let unlistenCalled = false

vi.mock('../../src/renderer/src/lib/api', () => ({
  api: {
    // load() 흐름에 필요한 최소 IPC mock
    getSystemPaths: vi.fn(() =>
      Promise.resolve({
        agents: '/tmp/agents',
        settings: '/tmp/settings.json',
        rules: '/tmp/rules',
        pipeline: '/tmp/pipeline.md',
      })
    ),
    readFile: vi.fn(() => Promise.resolve({ ok: true, content: '' })),
    listDir: vi.fn(() => Promise.resolve({ ok: true, files: [] })),
    // 실시간 리스너
    onClaudeSystemChanged: vi.fn((cb: SystemChangedCb) => {
      systemChangedCallback = cb
      return Promise.resolve(() => {
        unlistenCalled = true
        systemChangedCallback = null
      })
    }),
  },
}))

// 정적 JSON import mock — system-data.json 의 최소 형태만 제공
vi.mock('../../src/renderer/src/data/system-data.json', () => ({
  default: {
    agents: [],
    pipelines: [],
  },
}))

// 파서 mock — load() 흐름이 빈 배열을 받도록 단순화
vi.mock('../../src/renderer/src/lib/parsers/agent-parser', () => ({
  parseAgents: vi.fn(() => []),
}))
vi.mock('../../src/renderer/src/lib/parsers/hook-parser', () => ({
  parseHooks: vi.fn(() => []),
}))
vi.mock('../../src/renderer/src/lib/parsers/mcp-parser', () => ({
  parseMcpServers: vi.fn(() => []),
}))
vi.mock('../../src/renderer/src/lib/parsers/rule-parser', () => ({
  parseRules: vi.fn(() => []),
}))
vi.mock('../../src/renderer/src/lib/parsers/pipeline-parser', () => ({
  parsePipeline: vi.fn(() => []),
}))

import { useSystemData } from '../../src/renderer/src/lib/use-system-data'
import { api } from '../../src/renderer/src/lib/api'

describe('useSystemData — claude-system-changed 이벤트 자동 reload', () => {
  beforeEach(() => {
    systemChangedCallback = null
    unlistenCalled = false
    vi.clearAllMocks()
    // Tauri 환경 흉내 (window.__TAURI_INTERNALS__ 존재)
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    // mock 기본 동작 재설정 (clearAllMocks 가 구현을 지움)
    vi.mocked(api.getSystemPaths).mockResolvedValue({
      agents: '/tmp/agents',
      settings: '/tmp/settings.json',
      rules: '/tmp/rules',
      pipeline: '/tmp/pipeline.md',
    })
    vi.mocked(api.readFile).mockResolvedValue({ ok: true, content: '' })
    vi.mocked(api.listDir).mockResolvedValue({ ok: true, files: [] })
    vi.mocked(api.onClaudeSystemChanged).mockImplementation((cb: SystemChangedCb) => {
      systemChangedCallback = cb
      return Promise.resolve(() => {
        unlistenCalled = true
        systemChangedCallback = null
      })
    })
  })

  it('Tauri 환경에서 마운트 시 onClaudeSystemChanged 리스너가 등록된다', async () => {
    renderHook(() => useSystemData())

    // 초기 load + listener 등록 효과가 모두 처리되도록 마이크로태스크 flush
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(api.onClaudeSystemChanged).toHaveBeenCalledTimes(1)
  })

  it('claude-system-changed 이벤트 발생 시 load(getSystemPaths)가 다시 호출된다', async () => {
    renderHook(() => useSystemData())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // 마운트 시점 첫 load 호출 카운트
    const initialCalls = vi.mocked(api.getSystemPaths).mock.calls.length
    expect(initialCalls).toBeGreaterThanOrEqual(1)
    expect(systemChangedCallback).not.toBeNull()

    // 이벤트 발사
    await act(async () => {
      systemChangedCallback?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vi.mocked(api.getSystemPaths).mock.calls.length).toBeGreaterThan(initialCalls)
  })

  it('언마운트 시 unlisten이 호출된다', async () => {
    const { unmount } = renderHook(() => useSystemData())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    unmount()

    // unlisten은 promise chain 안에서 등록되므로 한 틱 더 기다림
    await act(async () => {
      await Promise.resolve()
    })

    expect(unlistenCalled).toBe(true)
  })

  it('비-Tauri 환경(__TAURI_INTERNALS__ 부재)에서는 리스너를 등록하지 않는다', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__

    renderHook(() => useSystemData())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(api.onClaudeSystemChanged).not.toHaveBeenCalled()
  })
})
