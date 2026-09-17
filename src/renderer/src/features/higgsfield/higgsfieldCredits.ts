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

/// 화면의 모든 날짜·D-day 판정 기준 시간대. 머신 로컬 설정에 따라 D-day가 흔들리지 않게 고정한다.
export const DISPLAY_TIME_ZONE = 'Asia/Seoul'

/// 경과가 이보다 짧으면 하루 평균이 의미를 갖지 못한다(45를 0.2일로 나누면 하루 225).
/// 이 구간에서는 예측을 내지 않고 "측정 중"으로 둔다.
export const MIN_PROJECTION_DAYS = 1

/// 일별 추이를 그릴 최대 구간. 갱신 이력이 없어 시작점을 못 잡을 때의 폭주를 막는다.
export const MAX_DAILY_SPAN_DAYS = 120

const SUBSCRIPTION_LABEL = 'Subscription Credits'
const SUBSCRIPTION_RESET_LABEL = 'Subscription Credits Reset'

/// 크레딧 지급·회수라서 "사용"이 아닌 액션.
/// 이 둘을 뺀 나머지는 모르는 액션이라도 사용 집계에 넣는다(조용히 누락되면 소멸 예측이 과대해진다).
const NON_USAGE_ACTIONS = new Set(['grant', 'deduct'])

/// 우리가 의미를 아는 사용 액션. 이 밖의 것이 오면 화면이 그 사실을 알린다.
const KNOWN_USAGE_ACTIONS = new Set(['spend', 'refund'])

export interface CreditEvent {
  at: number
  credits: number
  label: string
  /// 원본 액션(spend · refund · grant · deduct …). 환불을 사용 횟수로 세지 않으려고 보존한다.
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
    .filter((i) => i.action === 'deduct' && (i.display_name ?? '') === SUBSCRIPTION_RESET_LABEL)
    .map(toEvent)
    .filter((e): e is CreditEvent => e !== null)
    .sort((a, b) => b.at - a.at)
}

/// 정규 지급만 남긴다. 주기 중간에 들어오는 보정성 지급을 주기 시작으로 오인하면
/// D-day와 사용량 창이 통째로 밀린다.
///
/// 판정 기준은 **금액이 아니라 간격**이다. 금액(최빈값)으로 거르면 요금제를 바꿨을 때
/// 새 금액이 소수파가 되어 최신 갱신이 통째로 탈락한다(1500→3000 업그레이드 시 두 달 전 지급을
/// 현재 주기로 잡고 D-day 부호까지 뒤집혔다). 보정 지급은 금액이 아니라 "너무 이르게 들어왔다"는
/// 점에서 구별된다.
///
/// 임계는 관측된 최대 간격과 기본 주기 중 짧은 쪽의 절반이다. 장기 공백(결제 실패 등)이
/// 임계를 부풀려 정규 지급까지 걸러내는 것을 기본 주기가 막아 준다.
/// 간격이 임계보다 짧은 쌍에서는 금액이 큰 쪽(보정은 대개 소액)을 남기고, 동액이면 최신을 남긴다.
export function regularGrants(grants: CreditEvent[]): CreditEvent[] {
  if (grants.length <= 1) return grants

  const gaps: number[] = []
  for (let i = 0; i < grants.length - 1; i += 1) {
    gaps.push((grants[i].at - grants[i + 1].at) / DAY_MS)
  }
  const widest = gaps.length > 0 ? Math.max(...gaps) : DEFAULT_CYCLE_DAYS
  const thresholdDays = Math.min(widest, DEFAULT_CYCLE_DAYS) / 2

  // 최신순으로 훑으며, 직전에 남긴 지급과 너무 가까운 것은 보정으로 본다.
  const kept: CreditEvent[] = [grants[0]]
  for (let i = 1; i < grants.length; i += 1) {
    const candidate = grants[i]
    const last = kept[kept.length - 1]
    const gapDays = (last.at - candidate.at) / DAY_MS

    if (gapDays >= thresholdDays) {
      kept.push(candidate)
      continue
    }
    // 둘 중 하나는 보정이다. 금액이 큰 쪽을 정규로 남긴다(동액이면 이미 남긴 최신을 유지).
    if (candidate.credits > last.credits) kept[kept.length - 1] = candidate
  }

  return kept
}

export interface CycleEstimate {
  /// 현재 주기가 시작된 시각(마지막 정규 지급). 근거가 없으면 null.
  lastGrantAt: number | null
  /// 그 주기에 지급된 크레딧. 소멸 비율의 분모다.
  grantAmount: number | null
  cycleDays: number
  /// true면 주기를 실측하지 못하고 DEFAULT_CYCLE_DAYS를 가정했다는 뜻.
  assumedCycle: boolean
  /// 주기 산출에 쓴 간격 표본 수(정규 지급 건수 - 1).
  intervalSamples: number
  /// 주기 판정에 쓴 정규 지급 건수.
  grantCount: number
  nextRenewalAt: number | null
  /// 남은 일수(달력 기준). 이미 지났으면 음수.
  daysRemaining: number | null
  /// 주기 경과 비율 0~1.
  elapsedRatio: number | null
  /// 현재 주기가 시작된 뒤 지난 일수.
  elapsedDays: number | null
}

/// 인접 지급 간격(일)의 중앙값을 주기로 본다.
/// 평균이 아니라 중앙값을 쓰는 이유: 결제 실패로 한 주기가 길어져도 값이 끌려가지 않게 하려고.
export function estimateCycle(items: HiggsfieldTransaction[], now: number): CycleEstimate {
  const grants = regularGrants(subscriptionGrants(items))

  if (grants.length === 0) {
    return {
      lastGrantAt: null,
      grantAmount: null,
      cycleDays: DEFAULT_CYCLE_DAYS,
      assumedCycle: true,
      intervalSamples: 0,
      grantCount: 0,
      nextRenewalAt: null,
      daysRemaining: null,
      elapsedRatio: null,
      elapsedDays: null,
    }
  }

  const intervals: number[] = []
  for (let i = 0; i < grants.length - 1; i += 1) {
    const rawDays = (grants[i].at - grants[i + 1].at) / DAY_MS
    // 하루도 안 되는 간격은 주기가 아니다. 반올림 전 원시 값으로 판정한다
    // (Math.round(0.5)가 1이 되어 12시간 간격이 가드를 통과하던 구멍).
    if (rawDays >= 1) intervals.push(Math.round(rawDays))
  }

  const assumedCycle = intervals.length === 0
  const cycleDays = assumedCycle ? DEFAULT_CYCLE_DAYS : median(intervals)

  const lastGrantAt = grants[0].at
  const nextRenewalAt = lastGrantAt + cycleDays * DAY_MS
  const elapsedDays = (now - lastGrantAt) / DAY_MS

  return {
    lastGrantAt,
    grantAmount: grants[0].credits,
    cycleDays,
    assumedCycle,
    intervalSamples: intervals.length,
    grantCount: grants.length,
    nextRenewalAt,
    // D-day는 시각 차이가 아니라 달력 날짜 차이다.
    // 시간으로 올림하면 "이틀 전에 지났다"가 D+1로, "오늘 저녁 갱신"이 D-1로 나온다.
    daysRemaining: calendarDayDiff(now, nextRenewalAt),
    elapsedRatio: clamp01(elapsedDays / cycleDays),
    elapsedDays,
  }
}

const DAY_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/// 표시 시간대 기준 'YYYY-MM-DD'. 머신 로컬 시간대와 무관하게 같은 날짜를 가리킨다.
export function dayKey(ms: number): string {
  return DAY_KEY_FORMAT.format(new Date(ms))
}

function dayKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/// 두 시각 사이의 달력 날짜 차이(표시 시간대 기준).
export function calendarDayDiff(fromMs: number, toMs: number): number {
  return Math.round((dayKeyToUtcMs(dayKey(toMs)) - dayKeyToUtcMs(dayKey(fromMs))) / DAY_MS)
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

/// 순사용량 이벤트. 부호를 뒤집어 "쓴 양"으로 통일한다(spend -45 → +45, refund +2 → -2).
/// 구독 지급(grant)·갱신 회수(deduct)만 제외하고, 모르는 액션도 부호 그대로 집계에 넣는다.
/// 모르는 액션을 버리면 사용량이 과소 계산되고 그만큼 "소멸 예상"이 과대해진다.
export function netUsageSince(items: HiggsfieldTransaction[], since: number | null): CreditEvent[] {
  return items
    .filter((i) => !NON_USAGE_ACTIONS.has(i.action))
    .map(toEvent)
    .filter((e): e is CreditEvent => e !== null)
    .filter((e) => (since == null ? true : e.at >= since))
    .map((e) => ({ ...e, credits: -e.credits }))
}

/// 집계에 섞인 미지의 액션 종류. 비어 있지 않으면 화면이 신뢰도 하락을 고지한다.
export function unknownUsageActions(events: CreditEvent[]): string[] {
  const found = new Set<string>()
  for (const e of events) {
    if (!KNOWN_USAGE_ACTIONS.has(e.action)) found.add(e.action)
  }
  return [...found].sort()
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
  /// 정렬·중복 방지용 'YYYY-MM-DD'
  key: string
  /// 표시용 'MM/DD'
  date: string
  credits: number
}

/// 주기 시작일부터 오늘까지 일별 사용량. 안 쓴 날도 0으로 채워 추이가 끊기지 않게 한다.
/// 시작점이 없으면(갱신 이력 부재) 가장 오래된 사용부터 보되 MAX_DAILY_SPAN_DAYS로 자른다.
export function usageByDay(events: CreditEvent[], from: number | null, now: number): DailyUsageRow[] {
  if (events.length === 0 && from == null) return []

  const earliest = events.length > 0 ? events.reduce((min, e) => Math.min(min, e.at), events[0].at) : now
  const rawStart = from ?? earliest
  // 너무 먼 과거에서 시작하면 버킷이 폭주한다. 최근 구간만 그린다.
  const floorStart = now - MAX_DAILY_SPAN_DAYS * DAY_MS
  const startMs = Math.max(rawStart, floorStart)

  const span = calendarDayDiff(startMs, now)
  if (span < 0) return []

  const buckets = new Map<string, number>()
  const startKeyUtc = dayKeyToUtcMs(dayKey(startMs))
  for (let i = 0; i <= span; i += 1) {
    buckets.set(dayKey(startKeyUtc + i * DAY_MS), 0)
  }

  for (const e of events) {
    const key = dayKey(e.at)
    if (!buckets.has(key)) continue
    buckets.set(key, (buckets.get(key) ?? 0) + e.credits)
  }

  return [...buckets.entries()].map(([key, credits]) => ({
    key,
    date: key.slice(5).replace('-', '/'),
    credits,
  }))
}

export interface ExpiryProjection {
  /// 현재 주기의 하루 평균 사용량. 근거가 부족하면 null.
  perDay: number | null
  /// 남은 기간에 이 페이스로 더 쓸 양. 근거가 부족하면 null.
  projectedSpend: number | null
  /// 갱신 시점에 남아서 소멸할 것으로 보이는 양. **근거가 없으면 null이며, 잔액 전액으로 단정하지 않는다.**
  projectedExpiry: number | null
  /// 지급분 대비 소멸 비율(0~1). 지급량을 모르면 null.
  projectedExpiryRatio: number | null
  /// 예측을 내지 못한 이유. null이면 정상 예측.
  unavailableReason: 'no-grant-history' | 'too-early' | null
}

const NO_PROJECTION = (reason: ExpiryProjection['unavailableReason']): ExpiryProjection => ({
  perDay: null,
  projectedSpend: null,
  projectedExpiry: null,
  projectedExpiryRatio: null,
  unavailableReason: reason,
})

/// 현 페이스가 유지된다고 볼 때 갱신 시점에 얼마가 남아 사라지는지.
/// 갱신 이력이 없으면(경과 미상) 아무 값도 만들지 않는다. 근거 없이 "전액 소멸"이라고 말하는 쪽이 더 나쁘다.
export function projectExpiry(args: {
  balance: number
  spent: number
  elapsedDays: number | null
  cycleDays: number
  grantAmount?: number | null
}): ExpiryProjection {
  const { balance, spent, elapsedDays, cycleDays, grantAmount } = args

  if (elapsedDays == null) return NO_PROJECTION('no-grant-history')

  const elapsed = Math.max(elapsedDays, 0)
  // 주기가 막 시작됐고 아직 쓴 것도 없으면 "전액이 소멸한다"는 최대 경보만 남는다.
  // 그 구간에서만 예측을 보류한다. 쓴 기록이 있으면 아래 분모 하한으로 과대 추정을 막고 보여준다.
  if (elapsed < MIN_PROJECTION_DAYS && spent <= 0) return NO_PROJECTION('too-early')

  // 경과 0.2일에 45를 썼다고 하루 225로 보면 곧 전액 소진처럼 보인다. 분모 하한을 하루로 둔다.
  // 환불이 사용을 넘겨 spent가 음수여도 "앞으로 크레딧이 늘어난다"고 보지 않는다(0으로 바닥).
  const perDay = Math.max(spent / Math.max(elapsed, MIN_PROJECTION_DAYS), 0)
  const remainingDays = Math.max(cycleDays - elapsed, 0)
  const projectedSpend = perDay * remainingDays
  // 소멸 예상은 잔액을 넘을 수 없다.
  const projectedExpiry = Math.min(Math.max(balance - projectedSpend, 0), Math.max(balance, 0))
  const ratio = grantAmount && grantAmount > 0 ? clamp01(projectedExpiry / grantAmount) : null

  return {
    perDay,
    projectedSpend,
    projectedExpiry,
    projectedExpiryRatio: ratio,
    unavailableReason: null,
  }
}

/// 크레딧을 화면에 쓸 문자열로. 소수점은 실제로 소수인 값에만 붙인다(45 vs 2,395.1).
export function formatCredits(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
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
