import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfficeKpiStrip from '../../src/renderer/src/features/agent-office/OfficeKpiStrip'
import type { AgentStatus } from '../../src/renderer/src/features/agent-office/office-config'

// useCountUp은 rAF 의존 → 즉시 target 반환하도록 mock
vi.mock('../../src/renderer/src/lib/hooks/use-count-up', () => ({
  useCountUp: (target: number) => target,
}))

function makeStatuses(counts: Record<AgentStatus, number>): Map<string, AgentStatus> {
  const map = new Map<string, AgentStatus>()
  let i = 0
  for (const [status, count] of Object.entries(counts)) {
    for (let j = 0; j < count; j++) {
      map.set(`agent-${i++}`, status as AgentStatus)
    }
  }
  return map
}

describe('OfficeKpiStrip', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('상태별 집계가 정확함', () => {
    const statuses = makeStatuses({ working: 3, recent: 2, idle: 4, offline: 1 })

    render(
      <OfficeKpiStrip
        statuses={statuses}
        pipelineCount={18}
        toolCount={42}
        demoMode={false}
      />
    )

    // KPI 값 확인 (useCountUp mock이 즉시 target 반환)
    expect(screen.getByTestId('office-kpi-strip')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('에이전트 0명이면 모든 카운트 0', () => {
    const statuses = new Map<string, AgentStatus>()

    render(
      <OfficeKpiStrip
        statuses={statuses}
        pipelineCount={0}
        toolCount={0}
        demoMode={false}
      />
    )

    // 모든 KPI가 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(6)
  })

  it('DEMO MODE 뱃지 표시', () => {
    const statuses = makeStatuses({ working: 1, recent: 0, idle: 0, offline: 0 })

    render(
      <OfficeKpiStrip
        statuses={statuses}
        pipelineCount={0}
        toolCount={0}
        demoMode={true}
      />
    )

    expect(screen.getByTestId('demo-mode-badge')).toBeTruthy()
    expect(screen.getByText('DEMO MODE')).toBeTruthy()
  })

  it('DEMO MODE가 false면 뱃지 미표시', () => {
    const statuses = makeStatuses({ working: 1, recent: 0, idle: 0, offline: 0 })

    render(
      <OfficeKpiStrip
        statuses={statuses}
        pipelineCount={0}
        toolCount={0}
        demoMode={false}
      />
    )

    expect(screen.queryByTestId('demo-mode-badge')).toBeNull()
  })
})
