// TeamCodex 계정 풀의 판정 로직. 메뉴바(menubar/Sources/TeamCodexPoolStatus.swift)와
// 같은 우선순위·같은 낱말을 쓴다. 한 사람이 두 화면을 보면서 같은 개념에 두 낱말을 배우지 않도록,
// 상태 라벨·보조 문구·버튼 문구는 여기 한 곳에서만 만든다.
import type { TeamCodexPool } from '../../lib/types'

export type CodexPoolAccount = TeamCodexPool['accounts'][number]

/// 계정 한 줄에 무엇을 쓸지 정하는 우선순위.
/// 구독종료 → 오류 → 비활성 → 종료확인중 → 한도소진 → 일시대기 → 사용 중 순으로 강한 사실이 이긴다.
export type CodexAccountState =
  | 'retired'
  | 'excluded'
  | 'failed'
  | 'endDateReached'
  | 'limited'
  | 'paused'
  | 'serving'
  | 'other'

export type CodexRecoveryKind = 'enable' | 'reauth'

export interface CodexAccountRecovery {
  kind: CodexRecoveryKind
  title: string
  accessibilityLabel: string
  toolTip: string
  /// 눌러도 실행 중 서버에 바로 반영되지 않을 수 있는 경우에만 채운다.
  followUpNote: string | null
}

/// 다시 켠 계정이 실행 중 서버에 즉시 반영된다는 보장이 없다.
/// CLI가 직접 "Apply the change with: teamcodex codex restart"를 찍는다.
export const CODEX_ENABLE_FOLLOW_UP = '다시 켠 뒤 터미널 안내를 확인하세요 · 반영되지 않으면 teamcodex codex restart'

/// 꺼져 있으면서 인증까지 깨진 계정. 다시 켜도 빨간 상태가 남는다는 사실을 먼저 말한다.
export const CODEX_ENABLE_THEN_REAUTH_FOLLOW_UP = '다시 켠 뒤에도 인증 오류면 재인증이 필요합니다 · 반영은 teamcodex codex restart'

function timeValue(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function subscriptionState(account: CodexPoolAccount): string | null {
  return account.subscription?.state ?? null
}

export function subscriptionEndsAt(account: CodexPoolAccount): number | null {
  return timeValue(account.subscription?.endsAt ?? null)
}

/// 구독이 끝났다. 기다려도 돌아오지 않는다.
/// `end-date-reached`는 여기 넣지 않는다 — 프록시는 그 상태에서도 계속 요청을 보낸다.
export function isSubscriptionRetired(account: CodexPoolAccount): boolean {
  return account.errorReason === 'subscription-ended' || subscriptionState(account) === 'ended'
}

/// 종료일은 지났는데 프록시가 아직 종료로 확정하지 못한 계정. 지금도 요청을 받을 수 있다.
export function isSubscriptionEndDateReached(account: CodexPoolAccount, now: number): boolean {
  if (isSubscriptionRetired(account)) return false
  if (subscriptionState(account) === 'end-date-reached') return true
  if (subscriptionState(account) !== 'cancellation-scheduled') return false
  const endsAt = subscriptionEndsAt(account)
  return endsAt != null && endsAt <= now
}

/// 아직 서비스하지만 해지가 예약된 계정.
export function isSubscriptionEnding(account: CodexPoolAccount, now: number): boolean {
  return (
    subscriptionState(account) === 'cancellation-scheduled'
    && !isSubscriptionRetired(account)
    && !isSubscriptionEndDateReached(account, now)
  )
}

/// 잠시 빠진 것이 아니라 지금 풀에 없는 계정(구독 종료 또는 운영자가 끔).
export function isPermanentlyOut(account: CodexPoolAccount): boolean {
  return isSubscriptionRetired(account) || !account.enabled
}

export function isQuotaBlocked(account: CodexPoolAccount, switchThresholdPercent: number): boolean {
  return [account.sessionPercent, account.weeklyPercent]
    .filter((value): value is number => value != null)
    .some((value) => value >= switchThresholdPercent)
}

/// 지금 요청을 받을 수 있는가. 프록시가 `usable`을 주면 그 판정을 따른다.
export function isUsable(account: CodexPoolAccount, switchThresholdPercent: number): boolean {
  if (!account.enabled || isSubscriptionRetired(account)) return false
  if (typeof account.usable === 'boolean') return account.usable
  // 프록시 판정이 없는 행 = 아직 프록시가 싣지 않은 계정(오프라인 스냅샷, 재기동 전 신규 계정).
  // 설정 파일에 있다는 사실만으로 "지금 쓸 수 있다"고 세면 요약 수치가 거짓말을 한다.
  return (
    !['disabled', 'error', 'exhausted', 'throttled', 'configured', 'unknown'].includes(account.status)
    && !isQuotaBlocked(account, switchThresholdPercent)
  )
}

export function codexAccountState(
  account: CodexPoolAccount,
  switchThresholdPercent: number,
  now: number,
): CodexAccountState {
  if (isSubscriptionRetired(account)) return 'retired'
  // 꺼 둔 계정이라도 인증·전송 실패는 삼키지 않는다. 삼키면 다시 켜는 순간 처음 알게 된다.
  if (account.status === 'error' || account.errorReason) return 'failed'
  if (!account.enabled) return 'excluded'
  // 종료일 경과는 한도소진보다 강한 사실이다. "초기화되면 돌아온다"로 읽히면 안 된다.
  if (isSubscriptionEndDateReached(account, now)) return 'endDateReached'
  if (account.status === 'configured' || account.status === 'available') return 'other'
  if (
    account.status === 'exhausted'
    || account.status === 'throttled'
    || isQuotaBlocked(account, switchThresholdPercent)
  ) {
    return 'limited'
  }
  if (isUsable(account, switchThresholdPercent)) return 'serving'
  if (account.status === 'active') return 'paused'
  return 'other'
}

export function codexErrorReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case 'subscription-disabled': return '조직차단'
    case 'subscription-ended': return '구독종료'
    case 'auth-revoked': return '인증만료'
    case 'auth-rejected': return '인증거부'
    case 'refresh-failed': return '갱신실패'
    case 'send-failed': return '송신실패'
    default: return '오류'
  }
}

export function codexAccountStateLabel(
  state: CodexAccountState,
  status: string,
  errorReason: string | null | undefined,
): string {
  switch (state) {
    case 'retired': return '구독종료'
    // Claude 풀 표와 같은 낱말을 쓴다.
    case 'excluded': return '비활성'
    case 'failed': return codexErrorReasonLabel(errorReason)
    case 'endDateReached': return '종료확인중'
    case 'limited': return '한도소진'
    case 'paused': return '일시대기'
    case 'serving': return '사용 중'
    default:
      switch (status) {
        case 'available': return '대기'
        case 'configured': return '설정됨'
        case 'disabled': return '비활성'
        case 'exhausted': return '한도소진'
        case 'throttled': return '일시대기'
        default: return status
      }
  }
}

export function codexAccountStatusLabel(
  account: CodexPoolAccount,
  switchThresholdPercent: number,
  now: number,
): string {
  return codexAccountStateLabel(
    codexAccountState(account, switchThresholdPercent, now),
    account.status,
    account.errorReason,
  )
}

export function formatResetRemaining(target: number | null, now: number): string {
  if (target == null) return '시각 미측정'
  const seconds = Math.floor((target - now) / 1000)
  if (seconds <= 0) return '갱신 확인 중'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(1, minutes)}분 후`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes === 0 ? `${hours}시간 후` : `${hours}시간 ${remainingMinutes}분 후`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours === 0 ? `${days}일 후` : `${days}일 ${remainingHours}시간 후`
}

/// 계정 이름 아래 보조줄. "돌아온다 / 돌아오지 않는다"를 말로 못 박는다.
export function codexAccountNote(account: CodexPoolAccount, now: number): string | null {
  if (isSubscriptionRetired(account)) return '돌아오지 않음'
  if (isSubscriptionEndDateReached(account, now)) return '종료일 지남 · 연결 확인 중'
  // 오류가 상태 칸을 가져가더라도 "직접 껐다"는 사실은 보조줄이 계속 말한다.
  if (!account.enabled) return '직접 꺼 둔 계정'
  if (!isSubscriptionEnding(account, now)) return null
  const endsAt = subscriptionEndsAt(account)
  if (endsAt == null || endsAt <= now) return '구독 종료 예정'
  return `구독 종료 예정 · ${formatResetRemaining(endsAt, now)}`
}

/// 재인증으로는 풀리지 않는 오류 사유.
/// - `subscription-disabled`: 조직이 막았다.
/// - `send-failed`: 업스트림 전송 실패다. 자격증명 문제가 아니다.
export function codexReauthCannotFix(errorReason: string | null | undefined): boolean {
  return errorReason === 'subscription-disabled' || errorReason === 'send-failed'
}

/// 계정 한 줄에 어떤 되돌리기 버튼을 붙일지 정한다. 붙일 것이 없으면 null.
/// 판정 근거는 실제 CLI 동작이다: reauth는 oauth·codex·enabled 계정만 받고 accountUuid로 대조한다.
export function codexAccountRecovery(account: CodexPoolAccount): CodexAccountRecovery | null {
  // 계정 종류를 모르면 아무것도 제안하지 않는다.
  if ((account.accountType ?? '').toLowerCase() !== 'oauth') return null
  if ((account.provider ?? 'codex').toLowerCase() !== 'codex') return null

  // 구독이 끝난 계정: 다시 켜도, 다시 연결해도 돌아오지 않는다.
  if (isSubscriptionRetired(account)) return null

  // 꺼 둔 계정은 인증 상태와 무관하게 "다시 켜기"가 먼저다.
  // CLI reauth가 꺼 둔 계정을 거부하므로 순서를 바꾸면 실패할 명령을 띄우게 된다.
  if (!account.enabled) {
    const hasAuthIssue = (account.errorReason != null || account.status === 'error')
      && !codexReauthCannotFix(account.errorReason)
    const followUpNote = hasAuthIssue ? CODEX_ENABLE_THEN_REAUTH_FOLLOW_UP : CODEX_ENABLE_FOLLOW_UP
    return {
      kind: 'enable',
      title: '다시 켜기',
      accessibilityLabel: `다시 켜기: ${account.name}`,
      toolTip: `${account.name} 계정을 다시 풀에 넣습니다. ${followUpNote}`,
      followUpNote,
    }
  }

  // 재인증으로 풀리지 않는 사유는 버튼을 주지 않는다.
  if (codexReauthCannotFix(account.errorReason)) return null

  // 고칠 것이 있는 계정만 재인증을 제안한다. 한도소진·종료확인중·정상은 대상이 아니다.
  if (account.status !== 'error' && !account.errorReason) return null

  // 자격증명을 덮어쓰는 명령이라 신원이 확인된 행에서만 실행한다.
  if (!account.accountUuid) return null

  return {
    kind: 'reauth',
    title: '재인증 필요',
    accessibilityLabel: `재인증 필요: ${account.name}`,
    toolTip: `${account.name} 계정의 Codex 인증을 다시 연결합니다.`,
    followUpNote: null,
  }
}

export interface CodexPoolSummary {
  /// 풀에 남아 있는 계정 중 실제로 응답 중인 계정. 꺼 둔 계정·구독 종료 계정은 세지 않는다.
  activeCount: number
  /// 구독 종료·수동 제외를 뺀, 지금 풀에 남아 있는 계정 수.
  poolCount: number
  /// 지금 풀에 없는 계정 수(구독 종료 + 운영자가 끈 계정). "영구"라고 단정하지 않는다.
  excludedCount: number
  /// 지금 쓸 수 있는 계정 수. 프록시 판정(usable)을 우선한다.
  usableCount: number
}

export function summarizeCodexPool(pool: TeamCodexPool): CodexPoolSummary {
  const inPool = pool.accounts.filter((account) => !isPermanentlyOut(account))
  return {
    activeCount: inPool.filter((account) => account.status === 'active').length,
    poolCount: inPool.length,
    excludedCount: pool.accounts.length - inPool.length,
    usableCount: pool.accounts.filter(
      (account) => isUsable(account, pool.switchThresholdPercent),
    ).length,
  }
}
