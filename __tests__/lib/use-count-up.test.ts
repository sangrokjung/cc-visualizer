import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountUp, easeOutQuart } from '../../src/renderer/src/lib/hooks/use-count-up'

describe('easeOutQuart', () => {
  it('t=0 → 0, t=1 → 1', () => {
    expect(easeOutQuart(0)).toBe(0)
    expect(easeOutQuart(1)).toBe(1)
  })

  it('중간값은 선형보다 빠르게 진행 (easeOut)', () => {
    // t=0.5에서 easeOut은 0.5보다 커야 함
    expect(easeOutQuart(0.5)).toBeGreaterThan(0.5)
  })
})

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    let frameId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frameId++
      // 다음 tick에서 콜백 실행 (16ms 프레임)
      setTimeout(() => cb(performance.now()), 16)
      return frameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('target=0이면 초기값 0 반환', () => {
    const { result } = renderHook(() => useCountUp(0))
    expect(result.current).toBe(0)
  })

  it('target=100이면 애니메이션 완료 후 100 도달', () => {
    const { result } = renderHook(() => useCountUp(100, 500))

    // 애니메이션 시간(500ms) + 여유분 경과
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(100)
  })

  it('target이 변경되면 새 애니메이션 시작', () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, 500),
      { initialProps: { target: 50 } }
    )

    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(50)

    rerender({ target: 200 })
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current).toBe(200)
  })
})
