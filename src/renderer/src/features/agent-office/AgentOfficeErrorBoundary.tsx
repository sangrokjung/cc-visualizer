import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = {
  error: Error | null
}

export default class AgentOfficeErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, _errorInfo: { componentStack?: string | null }): void {
    // 데스크톱 앱이므로 콘솔 로그 항상 기록 (프로덕션 사용자도 DevTools 접근 가능)
    // eslint-disable-next-line no-console
    console.error('[AgentOffice] error caught by boundary:', error)
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback(error, this.handleReset)
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="h-full flex flex-col items-center justify-center gap-4 p-6"
        style={{ backgroundColor: '#0d0f14', color: '#C5CBD3' }}
        data-testid="agent-office-error-boundary"
      >
        <div className="text-4xl" aria-hidden="true">
          🏢💥
        </div>
        <h2 className="text-lg font-bold text-white">
          에이전트 오피스를 표시할 수 없습니다
        </h2>
        <p className="text-sm max-w-md text-center" style={{ color: '#ABB3BF' }}>
          예상하지 못한 오류가 발생했습니다. 다시 시도하거나 세션을 재시작해 주세요.
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="px-4 py-2 text-sm font-mono rounded border transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            backgroundColor: '#1C2127',
            borderColor: '#404854',
            color: '#C5CBD3',
          }}
        >
          다시 시도
        </button>
        <details className="mt-4 max-w-2xl w-full">
            <summary
              className="text-xs cursor-pointer font-mono"
              style={{ color: '#9AA4B2' }}
            >
              에러 상세 (개발 모드)
            </summary>
            <pre
              className="mt-2 p-3 text-[10px] overflow-auto rounded font-mono whitespace-pre-wrap"
              style={{
                backgroundColor: '#111418',
                border: '1px solid #404854',
                color: '#C5CBD3',
                maxHeight: 240,
              }}
            >
              {error.name}: {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
      </div>
    )
  }
}
