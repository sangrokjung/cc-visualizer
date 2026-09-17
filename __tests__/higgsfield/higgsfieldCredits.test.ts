import { describe, it, expect } from 'vitest'
import type { HiggsfieldTransaction } from '../../src/renderer/src/lib/types'
import {
  DEFAULT_CYCLE_DAYS,
  estimateCycle,
  formatCredits,
  formatDday,
  projectExpiry,
  netUsageSince,
  subscriptionGrants,
  subscriptionResets,
  totalSpend,
  usageByDay,
  usageByModel,
} from '../../src/renderer/src/features/higgsfield/higgsfieldCredits'

// 실제 `higgsfield account transactions --json` 응답에서 가져온 표본.
// 갱신은 grant + "Subscription Credits", 직전 잔여분 소멸은 deduct + "... Reset"으로 온다.
const REAL_ITEMS: HiggsfieldTransaction[] = [
  { action: 'spend', created_at: '2026-09-17T11:45:38.031744Z', credits: -45, display_name: 'Seedance 2.0' },
  { action: 'grant', created_at: '2026-09-17T08:00:24.719803Z', credits: 3000, display_name: 'Subscription Credits' },
  { action: 'deduct', created_at: '2026-09-17T08:00:24.711140Z', credits: -2395.1, display_name: 'Subscription Credits Reset' },
  { action: 'spend', created_at: '2026-09-16T12:10:38.843325Z', credits: -45, display_name: 'Seedance 2.0' },
  { action: 'spend', created_at: '2026-09-15T11:32:07.625942Z', credits: -45, display_name: 'Seedance 2.0' },
  { action: 'spend', created_at: '2026-09-06T11:44:58.086035Z', credits: -0.2, display_name: 'Seed Audio 1.0' },
  { action: 'grant', created_at: '2026-08-18T08:00:22.447444Z', credits: 3000, display_name: 'Subscription Credits' },
  { action: 'deduct', created_at: '2026-08-18T08:00:22.438500Z', credits: -2.83, display_name: 'Subscription Credits Reset' },
]

const NOW = new Date('2026-09-17T13:00:00.000Z').getTime()

describe('구독 이벤트 추출', () => {
  it('구독 지급만 최신순으로 고른다 (Reset은 섞이지 않는다)', () => {
    const grants = subscriptionGrants(REAL_ITEMS)
    expect(grants).toHaveLength(2)
    expect(grants[0].credits).toBe(3000)
    expect(grants[0].at).toBeGreaterThan(grants[1].at)
  })

  it('소멸(deduct) 이벤트를 따로 고른다', () => {
    const resets = subscriptionResets(REAL_ITEMS)
    expect(resets).toHaveLength(2)
    expect(resets[0].credits).toBe(-2395.1)
  })
})

describe('주기·재구독일 추정', () => {
  it('갱신 2건에서 30일 주기를 실측하고 다음 갱신일을 계산한다', () => {
    const cycle = estimateCycle(REAL_ITEMS, NOW)

    expect(cycle.cycleDays).toBe(30)
    expect(cycle.assumedCycle).toBe(false)
    expect(cycle.intervalSamples).toBe(1)
    // 2026-09-17T08:00Z + 30일
    expect(new Date(cycle.nextRenewalAt!).toISOString()).toBe('2026-10-17T08:00:24.719Z')
    expect(cycle.daysRemaining).toBe(30)
    expect(formatDday(cycle.daysRemaining)).toBe('D-30')
  })

  it('갱신이 1건뿐이면 기본 주기를 가정하고 그 사실을 표시한다', () => {
    const single = REAL_ITEMS.filter((i) => !i.created_at.startsWith('2026-08-18'))
    const cycle = estimateCycle(single, NOW)

    expect(cycle.assumedCycle).toBe(true)
    expect(cycle.cycleDays).toBe(DEFAULT_CYCLE_DAYS)
    expect(cycle.intervalSamples).toBe(0)
    expect(cycle.lastGrantAt).not.toBeNull()
  })

  it('갱신 기록이 없으면 갱신일을 만들어내지 않는다', () => {
    const cycle = estimateCycle(
      REAL_ITEMS.filter((i) => i.action === 'spend'),
      NOW
    )

    expect(cycle.lastGrantAt).toBeNull()
    expect(cycle.nextRenewalAt).toBeNull()
    expect(cycle.daysRemaining).toBeNull()
    expect(formatDday(cycle.daysRemaining)).toBe('-')
  })

  it('갱신 간격이 들쭉날쭉하면 중앙값을 쓴다 (한 번 밀려도 끌려가지 않는다)', () => {
    const items: HiggsfieldTransaction[] = [
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-08-18T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      // 결제 실패로 45일 만에 들어온 주기
      { action: 'grant', created_at: '2026-07-04T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-06-04T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
    ]
    // 간격: 30, 45, 30 → 중앙값 30
    expect(estimateCycle(items, NOW).cycleDays).toBe(30)
  })

  it('갱신일이 지났는데 아직 지급이 없으면 지난 날수만큼 D+로 표시한다', () => {
    // 예정일(10/17 17:00 KST)에서 이틀 지난 시점.
    const late = new Date('2026-10-19T08:00:00.000Z').getTime()
    const cycle = estimateCycle(REAL_ITEMS, late)

    expect(formatDday(cycle.daysRemaining)).toBe('D+2')
    // 경과 비율은 1을 넘지 않는다.
    expect(cycle.elapsedRatio).toBe(1)
  })

  it('갱신 예정일 당일이면 몇 시간 남았든 D-DAY다', () => {
    // 10/17 17:00 KST 갱신 예정, 지금은 같은 날 오전.
    const sameDay = new Date('2026-10-17T00:30:00.000Z').getTime()
    expect(formatDday(estimateCycle(REAL_ITEMS, sameDay).daysRemaining)).toBe('D-DAY')
    expect(formatDday(0)).toBe('D-DAY')
  })
})

describe('현재 주기 사용량', () => {
  it('마지막 갱신 이후의 spend만 센다 (지급·소멸은 사용이 아니다)', () => {
    const cycle = estimateCycle(REAL_ITEMS, NOW)
    const events = netUsageSince(REAL_ITEMS, cycle.lastGrantAt)

    expect(events).toHaveLength(1)
    expect(totalSpend(events)).toBe(45)
  })

  it('전체 기간을 보면 이전 주기 사용분까지 포함한다', () => {
    const events = netUsageSince(REAL_ITEMS, null)
    expect(totalSpend(events)).toBeCloseTo(135.2, 5)
  })

  it('모델별로 합산해 많이 쓴 순으로 준다', () => {
    const rows = usageByModel(netUsageSince(REAL_ITEMS, null))

    expect(rows[0]).toEqual({ name: 'Seedance 2.0', credits: 135, count: 3 })
    expect(rows[1].name).toBe('Seed Audio 1.0')
  })

  it('일별 추이는 안 쓴 날도 0으로 채운다', () => {
    // 9/6에 한 번 쓰고 9/15까지 쉰 구간이 있어야 "빈 날 채움"이 드러난다.
    const from = new Date('2026-09-06T00:00:00.000Z').getTime()
    const rows = usageByDay(netUsageSince(REAL_ITEMS, from), from, NOW)

    // 시작일부터 오늘까지 하루도 빠지지 않는다.
    expect(rows.length).toBeGreaterThan(3)
    expect(rows.some((r) => r.credits === 0)).toBe(true)
    expect(rows[rows.length - 1].credits).toBe(45)
    expect(rows.reduce((sum, r) => sum + r.credits, 0)).toBeCloseTo(135.2, 5)
  })

  it('사용 기록이 3일 연속이면 빈 날 없이 그대로 3일이다', () => {
    const from = new Date('2026-09-15T00:00:00.000Z').getTime()
    const rows = usageByDay(netUsageSince(REAL_ITEMS, from), from, NOW)

    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.credits > 0)).toBe(true)
  })
})

describe('환불(refund) 반영', () => {
  // 실측: 생성 실패 시 `refund` 액션으로 크레딧이 양수로 되돌아온다(Nano Banana Pro +2).
  const WITH_REFUND: HiggsfieldTransaction[] = [
    { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
    { action: 'spend', created_at: '2026-09-17T09:00:00Z', credits: -2, display_name: 'Nano Banana Pro' },
    { action: 'spend', created_at: '2026-09-17T09:05:00Z', credits: -2, display_name: 'Nano Banana Pro' },
    { action: 'refund', created_at: '2026-09-17T09:10:00Z', credits: 2, display_name: 'Nano Banana Pro' },
  ]
  const since = new Date('2026-09-17T08:00:00Z').getTime()

  it('돌려받은 크레딧만큼 사용량을 깎는다', () => {
    expect(totalSpend(netUsageSince(WITH_REFUND, since))).toBe(2)
  })

  it('환불 건은 사용 횟수로 세지 않는다', () => {
    const rows = usageByModel(netUsageSince(WITH_REFUND, since))
    expect(rows[0]).toEqual({ name: 'Nano Banana Pro', credits: 2, count: 2 })
  })

  it('지급·소멸은 여전히 사용량에 섞이지 않는다', () => {
    const withReset: HiggsfieldTransaction[] = [
      ...WITH_REFUND,
      { action: 'deduct', created_at: '2026-09-17T08:00:00Z', credits: -2395.1, display_name: 'Subscription Credits Reset' },
    ]
    expect(totalSpend(netUsageSince(withReset, since))).toBe(2)
  })
})

describe('소멸 예측', () => {
  it('현재 페이스로 남은 기간을 채우고 남는 양을 소멸로 본다', () => {
    const projection = projectExpiry({
      balance: 2955,
      spent: 45,
      elapsedDays: 5,
      cycleDays: 30,
      grantAmount: 3000,
    })

    expect(projection.perDay).toBe(9)
    expect(projection.projectedSpend).toBe(225) // 9 × 25일
    expect(projection.projectedExpiry).toBe(2730)
    expect(projection.projectedExpiryRatio).toBeCloseTo(0.91, 5)
  })

  it('페이스가 빠르면 소멸 0으로 바닥을 친다 (음수 잔여를 만들지 않는다)', () => {
    const projection = projectExpiry({
      balance: 500,
      spent: 2500,
      elapsedDays: 10,
      cycleDays: 30,
      grantAmount: 3000,
    })

    expect(projection.projectedExpiry).toBe(0)
    expect(projection.projectedExpiryRatio).toBe(0)
  })

  it('주기 시작 직후에도 하루치로 나눠 과대 추정하지 않는다', () => {
    const projection = projectExpiry({
      balance: 2955,
      spent: 45,
      elapsedDays: 0.2,
      cycleDays: 30,
      grantAmount: 3000,
    })

    // 0.2일로 나누면 하루 225가 되어 전액 소진으로 보인다. 분모 하한 1일.
    expect(projection.perDay).toBe(45)
    expect(projection.projectedExpiry).toBeGreaterThan(1500)
  })

  it('갱신 기록이 없으면(경과 미상) 예측을 만들어내지 않는다', () => {
    const projection = projectExpiry({
      balance: 2955,
      spent: 0,
      elapsedDays: null,
      cycleDays: 30,
      grantAmount: null,
    })

    expect(projection.perDay).toBe(0)
    expect(projection.projectedSpend).toBe(0)
    expect(projection.projectedExpiryRatio).toBeNull()
  })
})

describe('표시 형식', () => {
  it('정수는 소수점 없이, 소수는 한 자리까지', () => {
    expect(formatCredits(45)).toBe('45')
    expect(formatCredits(2395.1)).toBe('2,395.1')
    expect(formatCredits(0)).toBe('0')
  })
})
