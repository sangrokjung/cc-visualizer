import { Component, type ReactNode } from 'react'

// 뷰 단위 에러 경계 — 어떤 뷰가 throw해도 검은 화면 대신 에러 메시지 표시
type Props = {
  viewName: string
  children: ReactNode
}

type State = {
  error: Error | null
}

export default class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }): void {
    // eslint-disable-next-line no-console
    console.error(`[${this.props.viewName}] error caught:`, error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="h-full flex flex-col items-center justify-center gap-4 p-6"
        style={{ backgroundColor: '#0d0f14', color: '#C5CBD3' }}
      >
        <div className="text-4xl" aria-hidden="true">⚠️</div>
        <h2 className="text-lg font-bold" style={{ color: '#F6F7F9' }}>
          {this.props.viewName} 뷰를 표시할 수 없어요
        </h2>
        <p className="text-sm max-w-md text-center" style={{ color: '#ABB3BF' }}>
          예상치 못한 오류가 났어요. 다시 시도하거나 데이터 새로고침 후 다시 열어주세요.
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="px-4 py-2 text-sm rounded border transition-colors hover:bg-white/5"
          style={{ backgroundColor: '#1C2127', borderColor: '#404854', color: '#C5CBD3' }}
        >
          다시 시도
        </button>
        <details className="mt-4 max-w-2xl w-full">
          <summary
            className="text-xs cursor-pointer font-mono"
            style={{ color: '#9AA4B2' }}
          >
            에러 상세
          </summary>
          <pre
            className="mt-2 p-3 text-[10px] overflow-auto rounded font-mono whitespace-pre-wrap"
            style={{
              backgroundColor: '#111418',
              border: '1px solid #404854',
              color: '#C5CBD3',
              maxHeight: 240
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
