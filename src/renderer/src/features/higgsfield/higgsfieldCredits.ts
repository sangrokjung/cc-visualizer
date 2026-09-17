// 힉스필드 크레딧 계산. 화면(HiggsfieldView)과 분리해 두어 테스트가 시간을 주입할 수 있게 한다.
//
// 힉스필드 API는 "다음 재구독일"을 주지 않는다. 알 수 있는 건 거래내역뿐이고,
// 구독 갱신은 거기에 이렇게 남는다 (실측):
//   grant   +3000    "Subscription Credits"        ← 갱신 시각
//   deduct  -2395.1  "Subscription Credits Reset"  ← 직전 주기 미사용분 소멸
// 그래서 갱신일도 주기도 이 이력에서 역산한다. 추정이라는 사실은 화면이 숨기지 않는다.
import type { HiggsfieldTransaction } from '../../lib/types'

export const DAY_MS = 24 * 60 * 60 * 1000

/// grant 이력이 1건뿐이라 간격을 잴 수 없을 때 쓰는 가정치.
/// 실측(2026-08-18 → 2026-09-17)은 캘린더 월이 아니라 30일 고정이었다.
export const DEFAULT_CYCLE_DAYS = 30

const SUBSCRIPTION_LABEL = 'Subscription Credits'

export interface CreditEvent {
  at: number
  credits: number
  label: string
  /// 원본 액션(spend · refund · grant · deduct). 환불을 사용 횟수로 세지 않으려고 보존한다.
  action: string
}

function timeOf(value: string): number | null {
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function toEvent(item: HiggsfieldTransaction): CreditEvent | null {
  const at = timeOf(item.created_at)
  if (at == null) return null
  return { at, credits: item.credits, label: item.display_name ?? '', action: item.action }
}

/// 구독 지급(=재구독이 일어난 시각). 최신순.
/// "Subscription Credits Reset"은 action이 deduct라 여기 섞이지 않는다.
export function subscriptionGrants(items: HiggsfieldTransaction[]): CreditEvent[] {
  return items
    .filter((i) => i.action === 'grant' && (i.display_name ?? '').includes(SUBSCRIPTION_LABEL))
    .map(toEvent)
    .filter((e): e is CreditEvent => e !== null)
    .sort((a, b) => b.at - a.at)
}

/// 갱신 때 회수된 미사용분(소멸). 최신순.
export function subscriptionResets(items: HiggsfieldTransaction[]): CreditEvent[] {
  return items
    .filter((i) => i.action === 'deduct' && (i.display_name ?? '').includes(SUBSCRIPTION_LABEL))
    .map(toEvent)
    .filter((e): e is CreditEvent => e !== null)
    .sort((a, b) => b.at - a.at)
}

export interface CycleEstimate {
  /// 현재 주기가 시작된 시각(마지막 grant). 근거가 없으면 null.
  lastGrantAt: number | null
  cycleDays: number
  /// true면 주기를 실측하지 못하고 DEFAULT_CYCLE_DAYS를 가정했다는 뜻.
  assumedCycle: boolean
  /// 주기 산출에 쓴 간격 표본 수(grant 건수 - 1).
  intervalSamples: number
  nextRenewalAt: number | null
  /// 남은 일수(올림). 이미 지났으면 0 이하.
  daysRemaining: number | null
  /// 주기 경과 비율 0~1.
  elapsedRatio: number | null
  /// 현재 주기가 시작된 뒤 지난 일수.
  elapsedDays: number | null
}

/// 인접 grant 간격(일)의 중앙값을 주기로 본다.
/// 평균이 아니라 중앙값을 쓰는 이유: 결제 실패로 한 주기가 길어져도 값이 끌려가지 않게 하려고.
export function estimateCycle(items: HiggsfieldTransaction[], now: number): CycleEstimate {
  const grants = subscriptionGrants(items)

  if (grants.length === 0) {
    return {
      lastGrantAt: null,
      cycleDays: DEFAULT_CYCLE_DAYS,
      assumedCycle: true,
      intervalSamples: 0,
      nextRenewalAt: null,
      daysRemaining: null,
      elapsedRatio: null,
      elapsedDays: null,
    }
  }

  const intervals: number[] = []
  for (let i = 0; i < grants.length - 1; i += 1) {
    const days = Math.round((grants[i].at - grants[i + 1].at) / DAY_MS)
    // 같은 날 두 번 지급된 보정성 grant는 주기가 아니다.
    if (days >= 1) intervals.push(days)
  }

  const assumedCycle = intervals.length === 0
  const cycleDays = assumedCycle ? DEFAULT_CYCLE_DAYS : median(intervals)

  const lastGrantAt = grants[0].at
  const nextRenewalAt = lastGrantAt + cycleDays * DAY_MS
  const elapsedDays = (now - lastGrantAt) / DAY_MS

  return {
    lastGrantAt,
    cycleDays,
    assumedCycle,
    intervalSamples: intervals.length,
    nextRenewalAt,
    // D-day는 시각 차이가 아니라 달력 날짜 차이다.
    // 시간으로 올림하면 "이틀 전에 지났다"가 D+1로, "오늘 저녁 갱신"이 D-1로 나온다.
    daysRemaining: calendarDayDiff(now, nextRenewalAt),
    elapsedRatio: clamp01(elapsedDays / cycleDays),
    elapsedDays,
  }
}

/// 두 시각 사이의 달력 날짜 차이(로컬 기준). 서머타임이 있는 지역에서도 어긋나지 않게 반올림한다.
function calendarDayDiff(fromMs: number, toMs: number): number {
  return Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / DAY_MS)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/// 사용으로 집계할 액션. `refund`는 생성 실패 시 크레딧이 되돌아온 것이라(실측 +2)
/// 빼주지 않으면 사용량이 부풀고, 덩달아 소멸 예측이 실제보다 작게 나온다.
const USAGE_ACTIONS = new Set(['spend', 'refund'])

/// 순사용량 이벤트. 부호를 뒤집어 "쓴 양"으로 통일한다(spend -45 → +45, refund +2 → -2).
/// 구독 지급(grant)과 갱신 회수(deduct)는 사용이 아니라 제외한다.
export function netUsageSince(items: HiggsfieldTransaction[], since: number | null): CreditEvent[] {
  return items
    .filter((i) => USAGE_ACTIONS.has(i.action))
    .map(toEvent)
    .filter((e): e is CreditEvent => e !== null)
    .filter((e) => (since == null ? true : e.at >= since))
    .map((e) => ({ ...e, credits: -e.credits }))
}

export function totalSpend(events: CreditEvent[]): number {
  return events.reduce((sum, e) => sum + e.credits, 0)
}

export interface ModelUsageRow {
  name: string
  credits: number
  count: number
}

/// 모델(display_name)별 순사용량. 많이 쓴 순.
/// credits는 환불을 뺀 순액이고, count는 실제 사용 횟수(환불 건은 세지 않는다).
export function usageByModel(events: CreditEvent[]): ModelUsageRow[] {
  const rows = new Map<string, ModelUsageRow>()
  for (const e of events) {
    const name = e.label || '(이름 없음)'
    const row = rows.get(name) ?? { name, credits: 0, count: 0 }
    row.credits += e.credits
    if (e.action !== 'refund') row.count += 1
    rows.set(name, row)
  }
  return [...rows.values()].sort((a, b) => b.credits - a.credits)
}

export interface DailyUsageRow {
  /// 로컬 기준 'MM/DD'
  date: string
  credits: number
}

/// 주기 시작일부터 오늘까지 일별 사용량. 안 쓴 날도 0으로 채워 추이가 끊기지 않게 한다.
export function usageByDay(events: CreditEvent[], from: number | null, now: number): DailyUsageRow[] {
  if (events.length === 0 && from == null) return []

  const start = startOfLocalDay(from ?? Math.min(...events.map((e) => e.at)))
  const end = startOfLocalDay(now)
  // 방어: 시작이 미래면(시계 어긋남) 빈 배열.
  if (start > end) return []

  const buckets = new Map<string, number>()
  for (let day = start; day <= end; day += DAY_MS) {
    buckets.set(localDayKey(day), 0)
  }
  for (const e of events) {
    const key = localDayKey(e.at)
    if (!buckets.has(key)) continue
    buckets.set(key, (buckets.get(key) ?? 0) + e.credits)
  }
  return [...buckets.entries()].map(([date, credits]) => ({ date, credits }))
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function localDayKey(ms: number): string {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

export interface ExpiryProjection {
  /// 현재 주기의 하루 평균 사용량.
  perDay: number
  /// 남은 기간에 이 페이스로 더 쓸 양.
  projectedSpend: number
  /// 갱신 시점에 남아서 소멸할 것으로 보이는 양.
  projectedExpiry: number
  /// 지급분 대비 소멸 비율(0~1). 지급량을 모르면 null.
  projectedExpiryRatio: number | null
}

/// 현 페이스가 유지된다고 볼 때 갱신 시점에 얼마가 남아 사라지는지.
/// perDay는 경과 1일 미만 구간에서 과대 추정되기 쉬워 분모 하한을 1일로 둔다(보수적).
export function projectExpiry(args: {
  balance: number
  spent: number
  elapsedDays: number | null
  cycleDays: number
  grantAmount?: number | null
}): ExpiryProjection {
  const { balance, spent, elapsedDays, cycleDays, grantAmount } = args
  const elapsed = elapsedDays == null ? null : Math.max(elapsedDays, 0)
  const perDay = elapsed == null ? 0 : spent / Math.max(elapsed, 1)
  const remainingDays = elapsed == null ? 0 : Math.max(cycleDays - elapsed, 0)
  const projectedSpend = perDay * remainingDays
  const projectedExpiry = Math.max(balance - projectedSpend, 0)
  const ratio = grantAmount && grantAmount > 0 ? clamp01(projectedExpiry / grantAmount) : null

  return {
    perDay,
    projectedSpend,
    projectedExpiry,
    projectedExpiryRatio: ratio,
  }
}

/// 크레딧을 화면에 쓸 문자열로. 소수점은 실제로 소수인 값에만 붙인다(45 vs 2,395.1).
export function formatCredits(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString('ko-KR', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

/// 'D-30' / 'D-DAY' / 'D+2'. 갱신이 지났는데 아직 안 들어온 경우도 말이 되게 쓴다.
export function formatDday(daysRemaining: number | null): string {
  if (daysRemaining == null) return '-'
  if (daysRemaining > 0) return `D-${daysRemaining}`
  if (daysRemaining === 0) return 'D-DAY'
  return `D+${Math.abs(daysRemaining)}`
}
