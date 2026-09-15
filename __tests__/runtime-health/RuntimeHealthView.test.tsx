import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TeamClaudeHealth } from '../../src/renderer/src/lib/types'

const { mockFetchTeamClaudeHealth, mockFetchTeamCodexPool } = vi.hoisted(() => ({
  mockFetchTeamClaudeHealth: vi.fn(),
  mockFetchTeamCodexPool: vi.fn(),
}))

vi.mock('../../src/renderer/src/lib/api', () => ({
  api: {
    fetchTeamClaudeHealth: mockFetchTeamClaudeHealth,
    fetchTeamCodexPool: mockFetchTeamCodexPool,
  },
}))

import RuntimeHealthView from '../../src/renderer/src/features/runtime-health/RuntimeHealthView'

const warningHealth: TeamClaudeHealth = {
  checkedAt: '2026-07-09T03:00:00.000Z',
  overallStatus: 'warning',
  teamclaude: {
    config: {
      present: true,
      accountCount: 11,
      switchThreshold: 0.98,
      maxConcurrentPerAccount: 3,
      sessionAffinity: true,
    },
    server: {
      running: true,
      reachable: true,
      port: 3456,
      pid: 19311,
      startedAt: '2026-07-06T08:11:26.845Z',
    },
    accounts: {
      total: 11,
      configured: 11,
      active: 11,
      throttled: 0,
      exhausted: 0,
      error: 0,
      disabled: 0,
      inflight: 0,
      capacity: 33,
    },
    quota: {
      fableWeekly: {
        knownAccounts: 11,
        overThreshold: 11,
        allOverThreshold: true,
        minPercent: 100.1,
        maxPercent: 103.2,
        avgPercent: 101.7,
        soonestResetAt: '2026-07-10T00:00:00.000Z',
      },
    },
    retryAfterSeconds: 94,
  },
  routing: {
    currentProcessProxySet: false,
    defaultClaudeClearsProxy: true,
    teamclaudeConfigPresent: true,
  },
  hints: ['Fable 주간 쿼터가 모든 확인 계정에서 임계치 이상입니다.'],
}

const unreachableHealth: TeamClaudeHealth = {
  checkedAt: '2026-07-09T03:00:00.000Z',
  overallStatus: 'error',
  teamclaude: {
    config: {
      present: true,
      accountCount: 11,
      switchThreshold: 0.98,
      maxConcurrentPerAccount: null,
      sessionAffinity: false,
    },
    server: {
      running: false,
      reachable: false,
      port: 3456,
      pid: null,
      startedAt: null,
    },
    accounts: {
      total: 0,
      configured: 11,
      active: 0,
      throttled: 0,
      exhausted: 0,
      error: 0,
      disabled: 0,
      inflight: 0,
      capacity: 0,
    },
    quota: {
      fableWeekly: {
        knownAccounts: 0,
        overThreshold: 0,
        allOverThreshold: false,
        minPercent: null,
        maxPercent: null,
        avgPercent: null,
        soonestResetAt: null,
      },
    },
    retryAfterSeconds: null,
  },
  routing: {
    currentProcessProxySet: true,
    defaultClaudeClearsProxy: false,
    teamclaudeConfigPresent: true,
  },
  hints: ['teamclaude 서버에 연결할 수 없습니다.'],
}

describe('RuntimeHealthView', () => {
  beforeEach(() => {
    mockFetchTeamClaudeHealth.mockReset()
    mockFetchTeamCodexPool.mockReset()
    mockFetchTeamCodexPool.mockResolvedValue({
      checkedAt: '2026-07-24T00:00:00.000Z',
      serverReachable: true,
      serverPort: 3457,
      currentAccount: 'codex-main@example.com',
      switchThresholdPercent: 98,
      accounts: [
        {
          name: 'current-codex',
          isCurrent: false,
          enabled: true,
          status: 'error',
          sessionPercent: null,
          weeklyPercent: null,
          inflight: 0,
          maxConcurrent: 3,
          totalRequests: 21,
          totalTokens: 0,
        },
        {
          name: 'codex-main@example.com',
          isCurrent: true,
          enabled: true,
          status: 'active',
          sessionPercent: 27,
          weeklyPercent: 0,
          inflight: 3,
          maxConcurrent: 3,
          totalRequests: 36_748,
          totalTokens: 0,
        },
      ],
    })
  })

  it('teamclaude active 상태와 Fable 주간 경고를 렌더링한다', async () => {
    mockFetchTeamClaudeHealth.mockResolvedValue(warningHealth)

    render(<RuntimeHealthView />)

    expect(await screen.findByText('AI 계정 진단')).toBeTruthy()
    expect(screen.getByText('TeamCodex 계정 풀')).toBeTruthy()
    expect(screen.getByText('codex-main@example.com')).toBeTruthy()
    expect(screen.getByText('사용 중')).toBeTruthy()
    expect(screen.getByText('27.0%')).toBeTruthy()
    expect(screen.getByText('36,748')).toBeTruthy()
    expect(screen.getByText('연결됨')).toBeTruthy()
    expect(screen.getAllByText('11/11').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('103.2%')).toBeTruthy()
    expect(screen.getByText(/Fable 주간 쿼터/)).toBeTruthy()
  })

  it('teamclaude 서버 연결 실패 상태를 안전하게 렌더링한다', async () => {
    mockFetchTeamClaudeHealth.mockResolvedValue(unreachableHealth)

    render(<RuntimeHealthView />)

    expect(await screen.findByText('연결 실패')).toBeTruthy()
    expect(screen.getAllByText('0/0').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('남아 있음')).toBeTruthy()
    expect(screen.getByText(/teamclaude 서버에 연결할 수 없습니다/)).toBeTruthy()
  })

  it('새로고침 버튼으로 진단 정보를 다시 불러온다', async () => {
    mockFetchTeamClaudeHealth.mockResolvedValue(warningHealth)

    render(<RuntimeHealthView />)

    await screen.findByText('연결됨')
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    await waitFor(() => {
      expect(mockFetchTeamClaudeHealth).toHaveBeenCalledTimes(2)
    })
  })
})
