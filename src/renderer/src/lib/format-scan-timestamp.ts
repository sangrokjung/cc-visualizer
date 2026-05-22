// 시간 상수 (ms 단위)
const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** UTC 기준 "HH:MM" 문자열 반환 */
function toUTCHHMM(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** UTC 기준 "YYYY-MM-DD" 문자열 반환 */
function toUTCDate(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${month}-${day}`
}

/** UTC 기준 자정(00:00) Date 반환 */
function toUTCMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * scanTimestamp(ISO 문자열)를 사람이 읽기 쉬운 상대 시각으로 변환.
 * @param timestamp - ISO 8601 문자열 (예: "2026-05-13T14:03:21.332Z"). undefined 허용
 * @param now - 현재 시각 (테스트 주입용, 기본값: new Date())
 * @returns "방금 전" | "N분 전" | "N시간 전" | "어제 HH:MM" | "YYYY-MM-DD HH:MM" | "스캔 정보 없음"
 */
export function formatScanTimestamp(timestamp: string | undefined, now: Date = new Date()): string {
  if (timestamp === undefined) return '스캔 정보 없음'

  const ts = Date.parse(timestamp)
  if (Number.isNaN(ts)) return '스캔 정보 없음'

  const tsDate = new Date(ts)
  const diffMs = now.getTime() - ts

  // 30초 미만 → 방금 전
  if (diffMs < 30 * SECOND) return '방금 전'

  // 60분 미만 → N분 전
  if (diffMs < 60 * MINUTE) return `${Math.floor(diffMs / MINUTE)}분 전`

  // 날짜 경계 계산 (UTC 자정 기준)
  const dayDiffMs = toUTCMidnight(now).getTime() - toUTCMidnight(tsDate).getTime()

  // 어제 날짜 (날짜 기준, 시간 무관)
  if (dayDiffMs === DAY) return `어제 ${toUTCHHMM(tsDate)}`

  // 오늘(같은 날짜)이고 24시간 미만 → N시간 전
  if (dayDiffMs === 0 && diffMs < 24 * HOUR) return `${Math.floor(diffMs / HOUR)}시간 전`

  // 그 외 → "YYYY-MM-DD HH:MM"
  return `${toUTCDate(tsDate)} ${toUTCHHMM(tsDate)}`
}
