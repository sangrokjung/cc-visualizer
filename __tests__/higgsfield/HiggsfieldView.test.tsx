import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { HiggsfieldAccount, HiggsfieldTransactions } from '../../src/renderer/src/lib/types'

// recharts ResponsiveContainer는 jsdom에 없는 ResizeObserver를 요구한다.
// 이 프로젝트는 jest-dom도 setupFiles도 쓰지 않으므로 여기서 최소한만 채운다.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub
}

const { mockFetchAccount, mockFetchTransactions } = vi.hoisted(() => ({
  mockFetchAccount: vi.fn(),
  mockFetchTransactions: vi.fn(),
}))

vi.mock('../../src/renderer/src/lib/api', () => ({
  api: {
    fetchHiggsfieldAccount: mockFetchAccount,
    fetchHiggsfieldTransactions: mockFetchTransactions,
  },
}))

import HiggsfieldView from '../../src/renderer/src/features/higgsfield/HiggsfieldView'

const ACCOUNT: HiggsfieldAccount = {
  ok: true,
  checkedAt: '2026-09-17T13:00:00.000Z',
  account: {
    credits: 2955,
    email: 'sangrok@quantumjumpclub.com',
    subscription_plan_type: 'ultra',
  },
}

const TRANSACTIONS: HiggsfieldTransactions = {
  ok: true,
  checkedAt: '2026-09-17T13:00:00.000Z',
  items: [
    { action: 'spend', created_at: '2026-09-17T11:45:38.031744Z', credits: -45, display_name: 'Seedance 2.0' },
    { action: 'grant', created_at: '2026-09-17T08:00:24.719803Z', credits: 3000, display_name: 'Subscription Credits' },
    { action: 'deduct', created_at: '2026-09-17T08:00:24.711140Z', credits: -2395.1, display_name: 'Subscription Credits Reset' },
    { action: 'grant', created_at: '2026-08-18T08:00:22.447444Z', credits: 3000, display_name: 'Subscription Credits' },
  ],
}

const FIXED_NOW = new Date('2026-09-17T13:00:00.000Z').getTime()

describe('HiggsfieldView', () => {
  beforeEach(() => {
    // fake timer는 @testing-library의 waitFor 폴링과 얽힌다.
    // 뷰가 시각을 얻는 경로는 Date.now() 하나뿐이라 그것만 고정하면 충분하다.
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
    mockFetchAccount.mockResolvedValue(ACCOUNT)
    mockFetchTransactions.mockResolvedValue(TRANSACTIONS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('잔액·플랜·다음 리셋 D-day를 보여준다', async () => {
    render(<HiggsfieldView />)

    expect(await screen.findByText('힉스필드 크레딧')).toBeTruthy()
    expect(screen.getByText('2,955')).toBeTruthy()
    expect(screen.getByText(/ULTRA 플랜/)).toBeTruthy()
    expect(screen.getByText('다음 리셋까지')).toBeTruthy()
    // 2026-09-17 지급 + 실측 30일 주기
    expect(screen.getAllByText('D-30').length).toBeGreaterThan(0)
  })

  it('갱신 때 사라진 크레딧과 추정 근거를 함께 말한다', async () => {
    render(<HiggsfieldView />)

    expect(await screen.findByText('미사용분 소멸')).toBeTruthy()
    expect(screen.getByText(/2,395.1 크레딧이 실제로 소멸/)).toBeTruthy()
    expect(screen.getByText(/갱신일을 API로 주지 않습니다/)).toBeTruthy()
    expect(screen.getByText(/30일 주기 · 갱신 2건 실측/)).toBeTruthy()
  })

  it('CLI 실패는 빈 화면 대신 사유와 복구 명령을 보여준다', async () => {
    mockFetchAccount.mockResolvedValue({
      ok: false,
      checkedAt: '2026-09-17T13:00:00.000Z',
      error: 'Error: unauthorized. Run `higgsfield auth login`.',
    } satisfies HiggsfieldAccount)
    mockFetchTransactions.mockResolvedValue({
      ok: false,
      checkedAt: '2026-09-17T13:00:00.000Z',
      error: 'Error: unauthorized.',
      items: [],
    } satisfies HiggsfieldTransactions)

    render(<HiggsfieldView />)

    expect(await screen.findByText('힉스필드 정보를 불러오지 못했습니다')).toBeTruthy()
    expect(screen.getByText(/unauthorized/)).toBeTruthy()
    // CLI 원문에도 같은 명령이 실려 오므로, 우리 안내 문구를 따로 확인한다.
    expect(screen.getByText(/으로 로그인한 뒤 새로고침하세요/)).toBeTruthy()
    expect(screen.getAllByText('higgsfield auth login').length).toBeGreaterThan(0)
  })

  it('지급 기록이 없으면 갱신일을 지어내지 않는다', async () => {
    mockFetchTransactions.mockResolvedValue({
      ok: true,
      checkedAt: '2026-09-17T13:00:00.000Z',
      items: [
        { action: 'spend', created_at: '2026-09-17T11:45:38.031744Z', credits: -45, display_name: 'Seedance 2.0' },
      ],
    } satisfies HiggsfieldTransactions)

    render(<HiggsfieldView />)

    expect(
      await screen.findByText(/구독 지급 기록이 없어 갱신일을 계산할 수 없습니다/)
    ).toBeTruthy()
  })

  it('갱신 이력이 1건뿐이면 주기를 가정했다고 밝힌다', async () => {
    mockFetchTransactions.mockResolvedValue({
      ok: true,
      checkedAt: '2026-09-17T13:00:00.000Z',
      items: TRANSACTIONS.items.filter((i) => !i.created_at.startsWith('2026-08-18')),
    } satisfies HiggsfieldTransactions)

    render(<HiggsfieldView />)

    expect(await screen.findByText(/주기 미실측 · 기본 30일 가정/)).toBeTruthy()
    expect(screen.getByText(/지급 기록이 1건뿐이라 기본 주기를 가정했습니다/)).toBeTruthy()
  })
})
