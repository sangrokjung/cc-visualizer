import { describe, it, expect } from 'vitest'
import type { HiggsfieldTransaction } from '../../src/renderer/src/lib/types'
import {
  DEFAULT_CYCLE_DAYS,
  calendarDayDiff,
  dayKey,
  estimateCycle,
  formatCredits,
  formatDday,
  netUsageSince,
  projectExpiry,
  regularGrants,
  subscriptionGrants,
  subscriptionResets,
  totalSpend,
  unknownUsageActions,
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

  it('소멸(deduct)은 "Subscription Credits Reset" 정확히 일치할 때만 센다', () => {
    const resets = subscriptionResets(REAL_ITEMS)
    expect(resets).toHaveLength(2)
    expect(resets[0].credits).toBe(-2395.1)

    // 라벨이 다른 deduct는 구독 소멸이 아니다.
    const other: HiggsfieldTransaction[] = [
      { action: 'deduct', created_at: '2026-09-17T08:00:00Z', credits: -10, display_name: 'Subscription Credits Correction' },
    ]
    expect(subscriptionResets(other)).toHaveLength(0)
  })
})

describe('정규 지급 판별', () => {
  it('주기 중간의 보정성 지급을 주기 시작으로 삼지 않는다', () => {
    const items: HiggsfieldTransaction[] = [
      // 9/22에 들어온 200크레딧 보정 지급
      { action: 'grant', created_at: '2026-09-22T05:00:00Z', credits: 200, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-08-18T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
    ]
    const regular = regularGrants(subscriptionGrants(items))
    expect(regular).toHaveLength(2)
    expect(regular.every((g) => g.credits === 3000)).toBe(true)

    // 보정 지급이 있어도 주기 시작은 9/17이어야 한다.
    const cycle = estimateCycle(items, new Date('2026-09-23T00:00:00Z').getTime())
    expect(cycle.grantAmount).toBe(3000)
    expect(dayKey(cycle.lastGrantAt!)).toBe('2026-09-17')
    expect(cycle.cycleDays).toBe(30)
  })

  it('지급이 1건뿐이면 그대로 쓴다', () => {
    const one = subscriptionGrants([
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 500, display_name: 'Subscription Credits' },
    ])
    expect(regularGrants(one)).toHaveLength(1)
  })

  it('요금제를 바꿔도 최신 갱신을 버리지 않는다', () => {
    // 1500 → 3000 업그레이드. 금액 최빈값으로 거르면 새 금액이 소수파가 되어
    // 두 달 전 지급이 현재 주기로 잡히고 D-day 부호까지 뒤집힌다.
    const items: HiggsfieldTransaction[] = [
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-08-18T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-07-19T08:00:00Z', credits: 1500, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-06-19T08:00:00Z', credits: 1500, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-05-20T08:00:00Z', credits: 1500, display_name: 'Subscription Credits' },
    ]

    expect(regularGrants(subscriptionGrants(items))).toHaveLength(5)

    const cycle = estimateCycle(items, new Date('2026-09-18T00:00:00Z').getTime())
    expect(dayKey(cycle.lastGrantAt!)).toBe('2026-09-17')
    expect(cycle.grantAmount).toBe(3000)
    expect(cycle.cycleDays).toBe(30)
    // 어제 갱신됐는데 연체로 표시되면 안 된다.
    expect(cycle.daysRemaining).toBeGreaterThan(0)
  })

  it('업그레이드 직후(새 금액 1건)에도 최신 지급이 주기 시작이다', () => {
    const items: HiggsfieldTransaction[] = [
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-08-18T08:00:00Z', credits: 1500, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-07-19T08:00:00Z', credits: 1500, display_name: 'Subscription Credits' },
    ]
    const cycle = estimateCycle(items, new Date('2026-09-18T00:00:00Z').getTime())
    expect(dayKey(cycle.lastGrantAt!)).toBe('2026-09-17')
    expect(cycle.grantAmount).toBe(3000)
  })

  it('같은 날 두 번 지급돼도 주기가 반토막 나지 않는다', () => {
    // 12시간 간격이면 Math.round(0.5)=1이 되어 기존 `days >= 1` 가드를 통과했다.
    const items: HiggsfieldTransaction[] = [
      { action: 'grant', created_at: '2026-09-17T20:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'grant', created_at: '2026-08-18T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
    ]
    const cycle = estimateCycle(items, new Date('2026-09-18T00:00:00Z').getTime())

    expect(regularGrants(subscriptionGrants(items))).toHaveLength(2)
    // 16일(중앙값 오염)로 반토막 나던 자리.
    expect(cycle.cycleDays).toBeGreaterThanOrEqual(30)
    expect(cycle.cycleDays).toBeLessThanOrEqual(31)
  })
})

describe('주기·재구독일 추정', () => {
  it('갱신 2건에서 30일 주기를 실측하고 다음 갱신일을 계산한다', () => {
    const cycle = estimateCycle(REAL_ITEMS, NOW)

    expect(cycle.cycleDays).toBe(30)
    expect(cycle.assumedCycle).toBe(false)
    expect(cycle.intervalSamples).toBe(1)
    expect(cycle.grantCount).toBe(2)
    expect(cycle.grantAmount).toBe(3000)
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
    expect(cycle.grantAmount).toBeNull()
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

describe('날짜 기준 (KST 고정)', () => {
  it('머신 시간대와 무관하게 한국 날짜로 판정한다', () => {
    // 2026-09-17T16:00Z = KST 9/18 01:00 (UTC로는 아직 9/17)
    expect(dayKey(new Date('2026-09-17T16:00:00Z').getTime())).toBe('2026-09-18')
    expect(dayKey(new Date('2026-09-17T14:00:00Z').getTime())).toBe('2026-09-17')
  })

  it('달력 날짜 차이를 센다', () => {
    const a = new Date('2026-09-17T13:00:00Z').getTime()
    const b = new Date('2026-10-17T08:00:00Z').getTime()
    expect(calendarDayDiff(a, b)).toBe(30)
    expect(calendarDayDiff(b, a)).toBe(-30)
  })
})

describe('현재 주기 사용량', () => {
  it('마지막 갱신 이후의 사용만 센다 (지급·소멸은 사용이 아니다)', () => {
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

    expect(rows.length).toBeGreaterThan(3)
    expect(rows.some((r) => r.credits === 0)).toBe(true)
    expect(rows[rows.length - 1].credits).toBe(45)
    expect(rows.reduce((sum, r) => sum + r.credits, 0)).toBeCloseTo(135.2, 5)
  })

  it('일별 키는 연도를 포함해 해를 넘겨도 합쳐지지 않는다', () => {
    const items: HiggsfieldTransaction[] = [
      { action: 'spend', created_at: '2026-09-17T02:00:00Z', credits: -10, display_name: 'A' },
      { action: 'spend', created_at: '2025-09-17T02:00:00Z', credits: -20, display_name: 'A' },
    ]
    const rows = usageByDay(netUsageSince(items, null), null, NOW)
    const sameDayKeys = rows.filter((r) => r.date === '09/17')

    // 2025-09-17은 구간 상한(120일) 밖이라 잘리고, 2026-09-17 하나만 남는다.
    expect(sameDayKeys).toHaveLength(1)
    expect(sameDayKeys[0].key).toBe('2026-09-17')
    expect(sameDayKeys[0].credits).toBe(10)
    // 창 길이가 폭주하지 않는다.
    expect(rows.length).toBeLessThanOrEqual(121)
  })
})

describe('환불·미지 액션 반영', () => {
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

  it('모르는 액션도 부호대로 집계한다 (조용히 버리면 소멸 예측이 과대해진다)', () => {
    const items: HiggsfieldTransaction[] = [
      { action: 'grant', created_at: '2026-09-17T08:00:00Z', credits: 3000, display_name: 'Subscription Credits' },
      { action: 'spend', created_at: '2026-09-17T09:00:00Z', credits: -45, display_name: 'Seedance 2.0' },
      { action: 'expire', created_at: '2026-09-17T10:00:00Z', credits: -500, display_name: 'Promo Credits' },
      { action: 'adjust', created_at: '2026-09-17T11:00:00Z', credits: -100, display_name: 'Manual Adjustment' },
    ]
    const events = netUsageSince(items, since)
    expect(totalSpend(events)).toBe(645)
  })

  it('모르는 액션이 섞이면 그 사실을 알려준다', () => {
    const items: HiggsfieldTransaction[] = [
      { action: 'spend', created_at: '2026-09-17T09:00:00Z', credits: -45, display_name: 'Seedance 2.0' },
      { action: 'expire', created_at: '2026-09-17T10:00:00Z', credits: -500, display_name: 'Promo Credits' },
    ]
    expect(unknownUsageActions(netUsageSince(items, null))).toEqual(['expire'])
    expect(unknownUsageActions(netUsageSince(WITH_REFUND, since))).toEqual([])
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
    expect(projection.unavailableReason).toBeNull()
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

  it('주기 시작 직후라도 쓴 기록이 있으면 하루치로 나눠 보여준다', () => {
    const projection = projectExpiry({
      balance: 2955,
      spent: 45,
      elapsedDays: 0.2,
      cycleDays: 30,
      grantAmount: 3000,
    })

    // 0.2일로 나누면 하루 225가 되어 곧 전액 소진처럼 보인다. 분모 하한은 하루.
    expect(projection.perDay).toBe(45)
    expect(projection.unavailableReason).toBeNull()
    expect(projection.projectedExpiry).toBeGreaterThan(1500)
  })

  it('주기가 막 시작됐고 쓴 것도 없으면 "전액 소멸" 경보 대신 측정 중으로 둔다', () => {
    const projection = projectExpiry({
      balance: 3000,
      spent: 0,
      elapsedDays: 0.01,
      cycleDays: 30,
      grantAmount: 3000,
    })

    // 여기서 예측하면 매 주기 첫날 "3,000 전액 소멸 · 100%"가 뜬다.
    expect(projection.unavailableReason).toBe('too-early')
    expect(projection.projectedExpiry).toBeNull()
    expect(projection.perDay).toBeNull()
  })

  it('환불이 사용을 넘겨도 소멸 예상이 잔액을 넘지 않는다', () => {
    // 갱신 직전 생성분이 갱신 직후 환불되면 주기 사용량이 음수가 될 수 있다.
    // 그대로 두면 "잔여 3,000 / 소멸 예상 3,250"이라는 모순이 화면에 뜬다.
    const projection = projectExpiry({
      balance: 3000,
      spent: -50,
      elapsedDays: 5,
      cycleDays: 30,
      grantAmount: 3000,
    })

    expect(projection.perDay).toBe(0)
    expect(projection.projectedSpend).toBe(0)
    expect(projection.projectedExpiry).toBe(3000)
    expect(projection.projectedExpiry).toBeLessThanOrEqual(3000)
  })

  it('갱신 기록이 없으면 잔액 전액을 소멸로 단정하지 않는다', () => {
    const projection = projectExpiry({
      balance: 2955,
      spent: 0,
      elapsedDays: null,
      cycleDays: 30,
      grantAmount: null,
    })

    // 여기서 2955를 내놓으면 "근거 없음"과 "전액 소멸"을 한 화면에서 동시에 말하게 된다.
    expect(projection.projectedExpiry).toBeNull()
    expect(projection.projectedSpend).toBeNull()
    expect(projection.perDay).toBeNull()
    expect(projection.projectedExpiryRatio).toBeNull()
    expect(projection.unavailableReason).toBe('no-grant-history')
  })
})

describe('표시 형식', () => {
  it('정수는 소수점 없이, 소수는 한 자리까지', () => {
    expect(formatCredits(45)).toBe('45')
    expect(formatCredits(2395.1)).toBe('2,395.1')
    expect(formatCredits(0)).toBe('0')
  })

  it('값이 없으면 숫자를 지어내지 않는다', () => {
    expect(formatCredits(null)).toBe('-')
  })
})
