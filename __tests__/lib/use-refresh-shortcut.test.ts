import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// DataProvider mock — refreshSystem 호출 추적
const mockRefreshSystem = vi.fn(() => Promise.resolve())

vi.mock('../../src/renderer/src/lib/DataProvider', () => ({
  useSystemDataContext: () => ({
    refreshSystem: mockRefreshSystem,
    loading: false,
    systemData: {},
    usageData: {},
    externalSystems: {},
    refreshUsage: vi.fn(),
  }),
}))

import { useRefreshShortcut } from '../../src/renderer/src/lib/use-refresh-shortcut'

// KeyboardEvent를 생성하고 window에 dispatch, preventDefault spy 반환
function fireKey(
  key: string,
  options: { metaKey?: boolean; ctrlKey?: boolean } = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    bubbles: true,
    cancelable: true,
  })
  event.preventDefault = vi.fn()
  window.dispatchEvent(event)
  return event
}

describe('useRefreshShortcut', () => {
  beforeEach(() => {
    mockRefreshSystem.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Cmd+R 이벤트 발생 시 refreshSystem이 호출되고 preventDefault가 트리거된다', () => {
    renderHook(() => useRefreshShortcut())
    const event = fireKey('r', { metaKey: true })
    expect(mockRefreshSystem).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+R 이벤트 발생 시도 동일하게 동작한다', () => {
    renderHook(() => useRefreshShortcut())
    const event = fireKey('r', { ctrlKey: true })
    expect(mockRefreshSystem).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('F5 이벤트 발생 시도 동일하게 동작한다', () => {
    renderHook(() => useRefreshShortcut())
    const event = fireKey('F5')
    expect(mockRefreshSystem).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('INPUT 포커스 상태에서는 키 이벤트가 무시된다 (refreshSystem 호출 X, preventDefault 호출 X)', () => {
    renderHook(() => useRefreshShortcut())
    // INPUT 엘리먼트를 DOM에 추가하고 포커스
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = fireKey('r', { metaKey: true })
    expect(mockRefreshSystem).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('enabled=false일 때는 어떤 키도 동작하지 않는다', () => {
    renderHook(() => useRefreshShortcut({ enabled: false }))
    const event = fireKey('r', { metaKey: true })
    expect(mockRefreshSystem).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('언마운트 시 keydown 리스너가 제거된다', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useRefreshShortcut())
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
