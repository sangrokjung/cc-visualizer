import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'

// vi.hoisted — vi.mock 팩토리에서 외부 변수 참조하려면 필수 (coding-conventions.md)
const { mockContext } = vi.hoisted(() => ({
  mockContext: {
    refreshSystem: vi.fn(async () => {}),
    refreshUsage: vi.fn(async () => {}),
    loading: false,
    systemData: {} as Record<string, unknown>,
    usageData: {} as Record<string, unknown>,
    externalSystems: {} as Record<string, unknown>,
  },
}))

vi.mock('../../src/renderer/src/lib/DataProvider', () => ({
  useSystemDataContext: () => mockContext,
}))

import Sidebar from '../../src/renderer/src/components/Sidebar'

describe('Sidebar — 데이터 새로고침', () => {
  beforeEach(() => {
    mockContext.refreshSystem = vi.fn(async () => {})
    mockContext.loading = false
  })

  it('새로고침 버튼 클릭 시 refreshSystem IPC를 호출한다 (npm run scan 트리거)', async () => {
    render(<Sidebar activeView="dashboard" onViewChange={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /데이터 새로고침/ })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(mockContext.refreshSystem).toHaveBeenCalledTimes(1)
    })
  })

  it('window.location.reload를 호출하지 않는다 (React 상태 보존 회귀 방지)', () => {
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })

    render(<Sidebar activeView="dashboard" onViewChange={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /데이터 새로고침/ })
    fireEvent.click(btn)

    expect(reloadSpy).not.toHaveBeenCalled()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('loading=true일 때 새로고침 버튼이 disabled + aria-busy 설정된다', () => {
    mockContext.loading = true
    render(<Sidebar activeView="dashboard" onViewChange={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /스캔 중/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
  })

  it('loading=false 기본 상태에서 버튼 라벨에 ⟳ 아이콘이 포함된다', () => {
    render(<Sidebar activeView="dashboard" onViewChange={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /⟳ 데이터 새로고침/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('AI 계정 진단 항목 클릭 시 runtime-health 뷰로 이동한다', () => {
    const onViewChange = vi.fn()
    render(<Sidebar activeView="dashboard" onViewChange={onViewChange} />)
    fireEvent.click(screen.getByRole('button', { name: /AI 계정 진단/ }))
    expect(onViewChange).toHaveBeenCalledWith('runtime-health')
  })
})
