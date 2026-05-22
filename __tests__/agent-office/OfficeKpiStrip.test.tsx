import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfficeKpiStrip from '../../src/renderer/src/features/agent-office/OfficeKpiStrip'
import type { AgentStatus } from '../../src/renderer/src/features/agent-office/office-config'

// useCountUp은 rAF 의존 → 즉시 target 반환하도록 mock
vi.mock('../../src/renderer/src/lib/hooks/use-count-up', () => ({
  useCountUp: (target: number) => target,
}))

// LiveTicker가 useSessionEventsContext를 사용 — 빈 events mock
vi.mock('../../src/renderer/src/lib/SessionEventsProvider', () => ({
  useSessionEventsContext: () => ({
    events: [],
    sessionId: null,
    clearEvents: () => {},
    activeAgents: [],
    stats: { user: 0, assistant: 0, tool_use: 0, hook: 0, agent_spawn: 0, agent_progress: 0, system: 0 },
    recentTools: [],
    agentActivityMap: new Map(),
  }),
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

    // JARVIS HUD — 카운트는 3자리 padStart('003')
    expect(screen.getByTestId('office-kpi-strip')).toBeTruthy()
    expect(screen.getByText('003')).toBeTruthy() // working
    expect(screen.getByText('002')).toBeTruthy() // recent
    expect(screen.getByText('004')).toBeTruthy() // idle
    expect(screen.getByText('001')).toBeTruthy() // offline
    expect(screen.getByText('018')).toBeTruthy() // pipelines
    expect(screen.getByText('042')).toBeTruthy() // tools
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

    // 모든 KPI가 000 (3자리 padStart)
    const zeros = screen.getAllByText('000')
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

    // JARVIS HUD 텍스트는 "◢ DEMO ◣"
    expect(screen.getByTestId('demo-mode-badge')).toBeTruthy()
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
