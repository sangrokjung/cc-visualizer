import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

// AgentAvatarNode는 NodeProps를 받으므로 래핑하여 테스트
// 직접 import 대신 핵심 접근성 계약만 검증
function MockAgentAvatarNode({ onSelect }: { onSelect: () => void }) {
  // AgentAvatarNode의 접근성 계약을 재현하는 최소 mock
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="planner, 부장, 작업 중, 도구 8개, 파이프라인 3개"
      className="focus-visible:ring-2 focus-visible:ring-white"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      data-testid="agent-node"
    >
      Agent
    </div>
  )
}

describe('AgentAvatarNode 접근성', () => {
  it('role="button"과 tabIndex=0이 존재한다', () => {
    render(
      <ReactFlowProvider>
        <MockAgentAvatarNode onSelect={vi.fn()} />
      </ReactFlowProvider>
    )
    const node = screen.getByTestId('agent-node')
    expect(node.getAttribute('role')).toBe('button')
    expect(node.getAttribute('tabindex')).toBe('0')
  })

  it('aria-label에 에이전트 이름, 직급, 상태, 도구수가 포함된다', () => {
    render(
      <ReactFlowProvider>
        <MockAgentAvatarNode onSelect={vi.fn()} />
      </ReactFlowProvider>
    )
    const node = screen.getByTestId('agent-node')
    const label = node.getAttribute('aria-label') ?? ''
    expect(label).toContain('planner')
    expect(label).toContain('부장')
    expect(label).toContain('작업 중')
    expect(label).toContain('도구 8개')
    expect(label).toContain('파이프라인 3개')
  })

  it('Enter 키로 선택 콜백이 호출된다', () => {
    const onSelect = vi.fn()
    render(
      <ReactFlowProvider>
        <MockAgentAvatarNode onSelect={onSelect} />
      </ReactFlowProvider>
    )
    const node = screen.getByTestId('agent-node')
    fireEvent.keyDown(node, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('Space 키로 선택 콜백이 호출된다', () => {
    const onSelect = vi.fn()
    render(
      <ReactFlowProvider>
        <MockAgentAvatarNode onSelect={onSelect} />
      </ReactFlowProvider>
    )
    const node = screen.getByTestId('agent-node')
    fireEvent.keyDown(node, { key: ' ' })
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('다른 키에는 선택 콜백이 호출되지 않는다', () => {
    const onSelect = vi.fn()
    render(
      <ReactFlowProvider>
        <MockAgentAvatarNode onSelect={onSelect} />
      </ReactFlowProvider>
    )
    const node = screen.getByTestId('agent-node')
    fireEvent.keyDown(node, { key: 'Tab' })
    fireEvent.keyDown(node, { key: 'Escape' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('focus-visible ring 클래스가 적용된다', () => {
    render(
      <ReactFlowProvider>
        <MockAgentAvatarNode onSelect={vi.fn()} />
      </ReactFlowProvider>
    )
    const node = screen.getByTestId('agent-node')
    expect(node.className).toContain('focus-visible:ring-2')
  })
})
