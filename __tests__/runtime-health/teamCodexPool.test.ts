import { describe, it, expect } from 'vitest'
import {
  codexAccountState,
  codexAccountStatusLabel,
  codexAccountNote,
  codexAccountRecovery,
  codexErrorReasonLabel,
  formatResetRemaining,
  isSubscriptionEndDateReached,
  isUsable,
  summarizeCodexPool,
  CODEX_ENABLE_FOLLOW_UP,
  CODEX_ENABLE_THEN_REAUTH_FOLLOW_UP,
  type CodexPoolAccount,
} from '../../src/renderer/src/features/runtime-health/teamCodexPool'
import type { TeamCodexPool } from '../../src/renderer/src/lib/types'

const NOW = Date.parse('2026-10-09T12:00:00Z')
const THRESHOLD = 90
const HOUR = 60 * 60 * 1000

function account(overrides: Partial<CodexPoolAccount> = {}): CodexPoolAccount {
  return {
    name: 'acct',
    accountUuid: 'uuid-1',
    isCurrent: false,
    enabled: true,
    status: 'active',
    errorReason: null,
    usable: true,
    accountType: 'oauth',
    provider: 'codex',
    planType: 'pro',
    subscription: null,
    sessionPercent: 10,
    weeklyPercent: 20,
    inflight: 0,
    maxConcurrent: 4,
    totalRequests: 0,
    totalTokens: 0,
    ...overrides,
  }
}

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString()
}

describe('codexAccountState 우선순위', () => {
  it('정상 계정은 serving → "사용 중"', () => {
    expect(codexAccountState(account(), THRESHOLD, NOW)).toBe('serving')
    expect(codexAccountStatusLabel(account(), THRESHOLD, NOW)).toBe('사용 중')
  })

  it('구독 종료는 오류·비활성보다 우선한다', () => {
    const a = account({
      enabled: false,
      status: 'error',
      errorReason: 'auth-revoked',
      subscription: { state: 'ended', endsAt: null },
    })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('retired')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('구독종료')
  })

  it('errorReason=subscription-ended도 구독종료로 본다', () => {
    const a = account({ status: 'error', errorReason: 'subscription-ended' })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('retired')
  })

  it('꺼 둔 계정이라도 오류는 삼키지 않는다', () => {
    const a = account({ enabled: false, status: 'error', errorReason: 'auth-rejected' })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('failed')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('인증거부')
  })

  it('꺼 둔 계정은 status가 active여도 "비활성"', () => {
    const a = account({ enabled: false, status: 'active' })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('excluded')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('비활성')
  })

  it('종료일 경과는 한도소진보다 우선한다', () => {
    const a = account({
      status: 'exhausted',
      subscription: { state: 'end-date-reached', endsAt: iso(-HOUR) },
    })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('endDateReached')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('종료확인중')
  })

  it('쿼터가 임계값 이상이면 한도소진', () => {
    const a = account({ usable: null, weeklyPercent: THRESHOLD })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('limited')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('한도소진')
  })

  it('active인데 프록시가 usable=false면 일시대기', () => {
    const a = account({ usable: false })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('paused')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('일시대기')
  })

  it('configured 계정은 other → "설정됨"', () => {
    const a = account({ status: 'configured', usable: null })
    expect(codexAccountState(a, THRESHOLD, NOW)).toBe('other')
    expect(codexAccountStatusLabel(a, THRESHOLD, NOW)).toBe('설정됨')
  })
})

describe('isSubscriptionEndDateReached', () => {
  it('cancellation-scheduled는 endsAt이 지났을 때만 종료확인중', () => {
    const past = account({ subscription: { state: 'cancellation-scheduled', endsAt: iso(-1) } })
    const future = account({ subscription: { state: 'cancellation-scheduled', endsAt: iso(HOUR) } })
    expect(isSubscriptionEndDateReached(past, NOW)).toBe(true)
    expect(isSubscriptionEndDateReached(future, NOW)).toBe(false)
  })

  it('endsAt이 파싱 불가하면 종료확인중으로 보지 않는다', () => {
    const a = account({ subscription: { state: 'cancellation-scheduled', endsAt: 'not-a-date' } })
    expect(isSubscriptionEndDateReached(a, NOW)).toBe(false)
  })
})

describe('isUsable', () => {
  it('프록시 판정(usable)이 있으면 그대로 따른다', () => {
    expect(isUsable(account({ usable: true, sessionPercent: 99 }), THRESHOLD)).toBe(true)
    expect(isUsable(account({ usable: false }), THRESHOLD)).toBe(false)
  })

  it('usable 필드가 없는 configured/unknown 행은 사용 가능으로 세지 않는다', () => {
    expect(isUsable(account({ usable: undefined, status: 'configured' }), THRESHOLD)).toBe(false)
    expect(isUsable(account({ usable: undefined, status: 'unknown' }), THRESHOLD)).toBe(false)
  })

  it('꺼 둔 계정·구독 종료 계정은 usable=true여도 쓸 수 없다', () => {
    expect(isUsable(account({ enabled: false, usable: true }), THRESHOLD)).toBe(false)
    expect(
      isUsable(account({ subscription: { state: 'ended', endsAt: null }, usable: true }), THRESHOLD),
    ).toBe(false)
  })
})

describe('codexErrorReasonLabel', () => {
  it.each([
    ['subscription-disabled', '조직차단'],
    ['subscription-ended', '구독종료'],
    ['auth-revoked', '인증만료'],
    ['auth-rejected', '인증거부'],
    ['refresh-failed', '갱신실패'],
    ['send-failed', '송신실패'],
    ['something-new', '오류'],
    [null, '오류'],
  ])('%s → %s', (reason, label) => {
    expect(codexErrorReasonLabel(reason)).toBe(label)
  })
})

describe('formatResetRemaining', () => {
  it('시각이 없으면 "시각 미측정"', () => {
    expect(formatResetRemaining(null, NOW)).toBe('시각 미측정')
  })

  it('이미 지난 시각은 "갱신 확인 중"', () => {
    expect(formatResetRemaining(NOW, NOW)).toBe('갱신 확인 중')
    expect(formatResetRemaining(NOW - 1000, NOW)).toBe('갱신 확인 중')
  })

  it('1분 미만은 1분으로 올린다', () => {
    expect(formatResetRemaining(NOW + 30_000, NOW)).toBe('1분 후')
  })

  it('시간·일 단위 경계', () => {
    expect(formatResetRemaining(NOW + 59 * 60_000, NOW)).toBe('59분 후')
    expect(formatResetRemaining(NOW + 2 * HOUR, NOW)).toBe('2시간 후')
    expect(formatResetRemaining(NOW + 2 * HOUR + 5 * 60_000, NOW)).toBe('2시간 5분 후')
    expect(formatResetRemaining(NOW + 24 * HOUR, NOW)).toBe('1일 후')
    expect(formatResetRemaining(NOW + 27 * HOUR, NOW)).toBe('1일 3시간 후')
  })
})

describe('codexAccountNote', () => {
  it('구독 종료 → "돌아오지 않음"', () => {
    const a = account({ subscription: { state: 'ended', endsAt: null } })
    expect(codexAccountNote(a, NOW)).toBe('돌아오지 않음')
  })

  it('종료일 경과 → 연결 확인 중', () => {
    const a = account({ subscription: { state: 'end-date-reached', endsAt: iso(-HOUR) } })
    expect(codexAccountNote(a, NOW)).toBe('종료일 지남 · 연결 확인 중')
  })

  it('오류가 있어도 꺼 둔 사실은 보조줄이 말한다', () => {
    const a = account({ enabled: false, status: 'error', errorReason: 'auth-revoked' })
    expect(codexAccountNote(a, NOW)).toBe('직접 꺼 둔 계정')
  })

  it('해지 예정이면 남은 시간을 붙인다', () => {
    const a = account({ subscription: { state: 'cancellation-scheduled', endsAt: iso(3 * HOUR) } })
    expect(codexAccountNote(a, NOW)).toBe('구독 종료 예정 · 3시간 후')
  })

  it('해지 예정인데 endsAt이 없으면 시간 없이 표시', () => {
    const a = account({ subscription: { state: 'cancellation-scheduled', endsAt: null } })
    expect(codexAccountNote(a, NOW)).toBe('구독 종료 예정')
  })

  it('정상 계정은 보조줄 없음', () => {
    expect(codexAccountNote(account(), NOW)).toBeNull()
  })
})

describe('codexAccountRecovery', () => {
  it('정상 계정에는 버튼을 붙이지 않는다', () => {
    expect(codexAccountRecovery(account())).toBeNull()
  })

  it('oauth/codex가 아니면 아무것도 제안하지 않는다', () => {
    expect(codexAccountRecovery(account({ enabled: false, accountType: 'apikey' }))).toBeNull()
    expect(codexAccountRecovery(account({ enabled: false, accountType: null }))).toBeNull()
    expect(codexAccountRecovery(account({ enabled: false, provider: 'claude' }))).toBeNull()
  })

  it('구독 종료 계정은 되돌리기 없음', () => {
    const a = account({ enabled: false, subscription: { state: 'ended', endsAt: null } })
    expect(codexAccountRecovery(a)).toBeNull()
  })

  it('꺼 둔 계정은 인증 오류가 있어도 "다시 켜기"가 먼저', () => {
    const plain = codexAccountRecovery(account({ name: 'a1', enabled: false }))
    expect(plain?.kind).toBe('enable')
    expect(plain?.followUpNote).toBe(CODEX_ENABLE_FOLLOW_UP)
    expect(plain?.accessibilityLabel).toBe('다시 켜기: a1')

    const broken = codexAccountRecovery(
      account({ enabled: false, status: 'error', errorReason: 'auth-revoked' }),
    )
    expect(broken?.kind).toBe('enable')
    expect(broken?.followUpNote).toBe(CODEX_ENABLE_THEN_REAUTH_FOLLOW_UP)
  })

  it('꺼 둔 계정의 오류가 재인증으로 못 고치는 사유면 재인증 안내를 붙이지 않는다', () => {
    const a = account({ enabled: false, status: 'error', errorReason: 'send-failed' })
    expect(codexAccountRecovery(a)?.followUpNote).toBe(CODEX_ENABLE_FOLLOW_UP)
  })

  it('인증 오류 + accountUuid가 있으면 재인증', () => {
    const r = codexAccountRecovery(account({ name: 'a2', status: 'error', errorReason: 'auth-revoked' }))
    expect(r?.kind).toBe('reauth')
    expect(r?.accessibilityLabel).toBe('재인증 필요: a2')
    expect(r?.followUpNote).toBeNull()
  })

  it('재인증으로 못 고치는 사유·신원 미확인 행은 버튼 없음', () => {
    expect(codexAccountRecovery(account({ status: 'error', errorReason: 'subscription-disabled' }))).toBeNull()
    expect(codexAccountRecovery(account({ status: 'error', errorReason: 'send-failed' }))).toBeNull()
    expect(
      codexAccountRecovery(account({ status: 'error', errorReason: 'auth-revoked', accountUuid: null })),
    ).toBeNull()
  })
})

describe('summarizeCodexPool', () => {
  it('제외(구독 종료+꺼 둔 계정)는 풀·사용 가능에서 빠진다', () => {
    const pool: TeamCodexPool = {
      checkedAt: new Date(NOW).toISOString(),
      serverReachable: true,
      serverPort: 3457,
      currentAccount: 'serving',
      switchThresholdPercent: THRESHOLD,
      accounts: [
        account({ name: 'serving' }),
        account({ name: 'paused', usable: false }),
        account({ name: 'no-verdict', usable: undefined, status: 'configured' }),
        account({ name: 'off', enabled: false }),
        account({ name: 'retired', subscription: { state: 'ended', endsAt: null } }),
      ],
    }
    expect(summarizeCodexPool(pool)).toEqual({
      activeCount: 2,
      poolCount: 3,
      excludedCount: 2,
      usableCount: 1,
    })
  })
})
