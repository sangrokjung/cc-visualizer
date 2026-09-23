import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TeamClaudeHealth } from '../../src/renderer/src/lib/types'

const { mockFetchTeamClaudeHealth, mockFetchTeamCodexPool, mockRunTeamCodexAccountAction } = vi.hoisted(() => ({
  mockFetchTeamClaudeHealth: vi.fn(),
  mockFetchTeamCodexPool: vi.fn(),
  mockRunTeamCodexAccountAction: vi.fn(),
}))

vi.mock('../../src/renderer/src/lib/api', () => ({
  api: {
    fetchTeamClaudeHealth: mockFetchTeamClaudeHealth,
    fetchTeamCodexPool: mockFetchTeamCodexPool,
    runTeamCodexAccountAction: mockRunTeamCodexAccountAction,
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
    mockRunTeamCodexAccountAction.mockReset()
    mockRunTeamCodexAccountAction.mockResolvedValue({
      ok: true,
      needsRestart: true,
      message: '터미널에서 다시 켜기 명령을 실행합니다. 반영되지 않으면 teamcodex codex restart가 필요합니다.',
    })
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
        {
          // 프록시는 꺼 둔 계정도 status:"active"로 준다. 화면은 비활성이라고 써야 한다.
          name: 'codex-off@example.com',
          accountUuid: '33333333-3333-4333-8333-333333333333',
          isCurrent: false,
          enabled: false,
          status: 'active',
          errorReason: null,
          usable: false,
          accountType: 'oauth',
          provider: 'codex',
          subscription: { state: 'active', endsAt: null },
          sessionPercent: null,
          weeklyPercent: null,
          inflight: 0,
          maxConcurrent: 3,
          totalRequests: 0,
          totalTokens: 0,
        },
        {
          name: 'codex-auth@example.com',
          accountUuid: '44444444-4444-4444-8444-444444444444',
          isCurrent: false,
          enabled: true,
          status: 'error',
          errorReason: 'auth-revoked',
          usable: false,
          accountType: 'oauth',
          provider: 'codex',
          subscription: { state: 'active', endsAt: null },
          sessionPercent: null,
          weeklyPercent: null,
          inflight: 0,
          maxConcurrent: 3,
          totalRequests: 0,
          totalTokens: 0,
        },
        {
          name: 'codex-ended@example.com',
          accountUuid: '55555555-5555-4555-8555-555555555555',
          isCurrent: false,
          enabled: false,
          status: 'error',
          errorReason: 'subscription-ended',
          usable: false,
          accountType: 'oauth',
          provider: 'codex',
          subscription: { state: 'ended', endsAt: '2026-07-01T00:00:00.000Z' },
          sessionPercent: null,
          weeklyPercent: null,
          inflight: 0,
          maxConcurrent: 3,
          totalRequests: 0,
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

  it('꺼 둔 계정·구독 종료 계정을 사용 가능으로 세지 않는다', async () => {
    mockFetchTeamClaudeHealth.mockResolvedValue(warningHealth)

    render(<RuntimeHealthView />)

    await screen.findByText('codex-main@example.com')
    // 5개 중 꺼 둔 계정 1 + 구독 종료 1이 빠져 풀 3, 그중 실제 사용 가능은 codex-main 하나뿐이다.
    expect(screen.getByText(/사용 가능 1 · 풀 3 · 제외 2/)).toBeTruthy()
    expect(screen.getByText('비활성')).toBeTruthy()
    expect(screen.getByText('직접 꺼 둔 계정')).toBeTruthy()
    expect(screen.getByText('구독종료')).toBeTruthy()
    expect(screen.getByText('돌아오지 않음')).toBeTruthy()
    expect(screen.getByText('인증만료')).toBeTruthy()
  })

  it('되돌릴 수 있는 계정에만 버튼을 붙인다', async () => {
    mockFetchTeamClaudeHealth.mockResolvedValue(warningHealth)

    render(<RuntimeHealthView />)

    await screen.findByText('codex-main@example.com')
    expect(screen.getByRole('button', { name: '다시 켜기: codex-off@example.com' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '재인증 필요: codex-auth@example.com' })).toBeTruthy()
    // 구독 종료·정상 계정에는 되돌리기 버튼이 없다.
    expect(screen.queryByRole('button', { name: /codex-ended@example.com/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /codex-main@example.com/ })).toBeNull()
    // 다시 켜기는 실행 중 서버에 즉시 반영되지 않는다는 사실을 누르기 전에 말한다.
    expect(screen.getByText(/teamcodex codex restart/)).toBeTruthy()
  })

  it('다시 켜기 버튼은 구조화된 입력으로 Tauri 커맨드를 부른다', async () => {
    mockFetchTeamClaudeHealth.mockResolvedValue(warningHealth)

    render(<RuntimeHealthView />)

    await screen.findByText('codex-main@example.com')
    fireEvent.click(screen.getByRole('button', { name: '다시 켜기: codex-off@example.com' }))

    await waitFor(() => {
      expect(mockRunTeamCodexAccountAction).toHaveBeenCalledWith({
        action: 'enable',
        name: 'codex-off@example.com',
        accountUuid: '33333333-3333-4333-8333-333333333333',
      })
    })
    expect(await screen.findByRole('status')).toBeTruthy()
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
