import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AgentOfficeErrorBoundary from '@/features/agent-office/AgentOfficeErrorBoundary'

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test-error-message')
  return <div data-testid="child-ok">정상 렌더</div>
}

describe('AgentOfficeErrorBoundary', () => {
  // console.error 억제 (React 내부 에러 출력)
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it('정상 자식은 그대로 렌더한다', () => {
    render(
      <AgentOfficeErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </AgentOfficeErrorBoundary>
    )
    expect(screen.getByTestId('child-ok')).toBeTruthy()
  })

  it('자식 에러 시 fallback UI를 표시한다', () => {
    render(
      <AgentOfficeErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AgentOfficeErrorBoundary>
    )
    expect(screen.getByTestId('agent-office-error-boundary')).toBeTruthy()
    expect(screen.getByText('에이전트 오피스를 표시할 수 없습니다')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('"다시 시도" 버튼이 존재하고 클릭 가능하다', () => {
    render(
      <AgentOfficeErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AgentOfficeErrorBoundary>
    )

    // 에러 상태 확인
    expect(screen.getByTestId('agent-office-error-boundary')).toBeTruthy()

    // "다시 시도" 버튼 존재 + 클릭 가능 (handleReset 호출)
    const retryBtn = screen.getByText('다시 시도')
    expect(retryBtn).toBeTruthy()
    expect(retryBtn.tagName).toBe('BUTTON')
    expect(retryBtn.getAttribute('type')).toBe('button')

    // 클릭 시 에러 없이 실행됨 (setState 호출, 동일 에러 자식이므로 다시 fallback)
    fireEvent.click(retryBtn)
    // 에러 바운더리가 다시 에러를 캡처하므로 fallback 재표시
    expect(screen.getByTestId('agent-office-error-boundary')).toBeTruthy()
  })

  it('fallback UI에 role="alert"과 aria-live="assertive"가 있다', () => {
    render(
      <AgentOfficeErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AgentOfficeErrorBoundary>
    )
    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('aria-live')).toBe('assertive')
  })
})
