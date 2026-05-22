/**
 * gamification.test.ts — gamification.ts 순수 함수 테스트
 *
 * 비유: 계산기 내부 회로를 테스트한다. UI(화면) 없이 숫자만 넣고 숫자만 확인.
 */

import { describe, it, expect } from 'vitest'
import {
  calcXP,
  calcCostXP,
  calcLevel,
  getLevelBounds,
  getLevelTitle,
  calcLevelInfo,
  calcStreak,
  offsetDate,
  calcAchievements,
  calcGamification,
  type DailyEntry,
  type SystemStats,
} from '../../src/renderer/src/lib/gamification'

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

function makeEntry(
  period: string,
  totalTokens: number,
  totalCost = 0
): DailyEntry {
  return {
    period,
    totalTokens,
    totalCost,
    inputTokens: 0,
    outputTokens: 0,
  }
}

const baseStats: SystemStats = {
  agentCount: 50,
  skillCount: 100,
  hookCount: 30,
  ruleCount: 20,
  pipelineCount: 10,
  mcpServerCount: 5,
}

// ─────────────────────────────────────────────
// calcXP
// ─────────────────────────────────────────────

describe('calcXP', () => {
  it('0 토큰 → 0 XP', () => {
    expect(calcXP(0)).toBe(0)
  })

  it('100만 토큰 → 10 XP', () => {
    expect(calcXP(1_000_000)).toBe(10)
  })

  it('100억 토큰 → 100000 XP', () => {
    expect(calcXP(10_000_000_000)).toBe(100_000)
  })

  it('floor 처리: 99999 토큰 → 0 XP', () => {
    expect(calcXP(99_999)).toBe(0)
  })

  it('100000 토큰 → 1 XP', () => {
    expect(calcXP(100_000)).toBe(1)
  })
})

// ─────────────────────────────────────────────
// calcCostXP
// ─────────────────────────────────────────────

describe('calcCostXP', () => {
  it('$0 → 0 XP', () => {
    expect(calcCostXP(0)).toBe(0)
  })

  it('$100.5 → 100 XP', () => {
    expect(calcCostXP(100.5)).toBe(100)
  })

  it('$23225 → 23225 XP', () => {
    expect(calcCostXP(23225)).toBe(23225)
  })
})

// ─────────────────────────────────────────────
// calcLevel
// ─────────────────────────────────────────────

describe('calcLevel', () => {
  it('XP=0 → 레벨 1', () => {
    expect(calcLevel(0)).toBe(1)
  })

  it('XP=99 → 레벨 1 (임계값 100 미달)', () => {
    expect(calcLevel(99)).toBe(1)
  })

  it('XP=100 → 레벨 2', () => {
    expect(calcLevel(100)).toBe(2)
  })

  it('XP=250 → 레벨 3', () => {
    expect(calcLevel(250)).toBe(3)
  })

  it('XP=8000 → 레벨 10', () => {
    expect(calcLevel(8000)).toBe(10)
  })

  it('XP=22000 → 레벨 13 (최고 레벨)', () => {
    expect(calcLevel(22000)).toBe(13)
  })

  it('XP=999999 (최고 레벨 초과) → 레벨 13 유지', () => {
    expect(calcLevel(999999)).toBe(13)
  })
})

// ─────────────────────────────────────────────
// getLevelBounds
// ─────────────────────────────────────────────

describe('getLevelBounds', () => {
  it('레벨 1: start=0, end=100', () => {
    const { start, end } = getLevelBounds(1)
    expect(start).toBe(0)
    expect(end).toBe(100)
  })

  it('레벨 2: start=100, end=250', () => {
    const { start, end } = getLevelBounds(2)
    expect(start).toBe(100)
    expect(end).toBe(250)
  })
})

// ─────────────────────────────────────────────
// getLevelTitle
// ─────────────────────────────────────────────

describe('getLevelTitle', () => {
  it('레벨 1 → "수습 빌더"', () => {
    expect(getLevelTitle(1)).toBe('수습 빌더')
  })

  it('레벨 13 → "퀀텀 마스터"', () => {
    expect(getLevelTitle(13)).toBe('퀀텀 마스터')
  })

  it('레벨 999 (미정의) → 최고 레벨 칭호 반환', () => {
    // 미정의 레벨은 LEVEL_TITLES[13] fallback
    expect(getLevelTitle(999)).toBe('퀀텀 마스터')
  })
})

// ─────────────────────────────────────────────
// calcLevelInfo
// ─────────────────────────────────────────────

describe('calcLevelInfo', () => {
  it('0 토큰/0 비용 → 레벨 1, XP 0, 진행률 0', () => {
    const info = calcLevelInfo(0, 0)
    expect(info.level).toBe(1)
    expect(info.xp).toBe(0)
    expect(info.progressPercent).toBe(0)
    expect(info.title).toBe('수습 빌더')
  })

  it('1억 토큰 + $100 → XP=1100, 레벨 계산 일치', () => {
    const info = calcLevelInfo(100_000_000, 100)
    expect(info.xp).toBe(1100) // 1000 + 100
    // XP=1100: LEVEL_THRESHOLDS[4]=900(Lv5), [5]=1500(Lv6) → 레벨 5
    expect(info.level).toBe(5)
    expect(info.progressPercent).toBeGreaterThan(0)
    expect(info.progressPercent).toBeLessThanOrEqual(100)
  })

  it('progressPercent는 0~100 범위', () => {
    const testCases = [0, 50_000_000, 1_000_000_000, 100_000_000_000]
    for (const tokens of testCases) {
      const info = calcLevelInfo(tokens, 0)
      expect(info.progressPercent).toBeGreaterThanOrEqual(0)
      expect(info.progressPercent).toBeLessThanOrEqual(100)
    }
  })

  it('28억 토큰 (실제 누적) → 고레벨 반환', () => {
    const info = calcLevelInfo(28_171_068_175, 23225)
    // 실제 데이터: 28171 XP(토큰) + 23225 XP(비용) = 51396 XP
    // LEVEL_THRESHOLDS 상 22000+ → 레벨 13
    expect(info.level).toBe(13)
    expect(info.title).toBe('퀀텀 마스터')
  })
})

// ─────────────────────────────────────────────
// offsetDate
// ─────────────────────────────────────────────

describe('offsetDate', () => {
  it('하루 전', () => {
    expect(offsetDate('2026-05-22', -1)).toBe('2026-05-21')
  })

  it('하루 후', () => {
    expect(offsetDate('2026-05-31', 1)).toBe('2026-06-01')
  })

  it('0일 이동 → 동일 날짜', () => {
    expect(offsetDate('2026-01-15', 0)).toBe('2026-01-15')
  })

  it('월 경계 처리', () => {
    expect(offsetDate('2026-03-01', -1)).toBe('2026-02-28')
  })
})

// ─────────────────────────────────────────────
// calcStreak
// ─────────────────────────────────────────────

describe('calcStreak', () => {
  it('빈 배열 → 스트릭 0', () => {
    const result = calcStreak([], '2026-05-22')
    expect(result.current).toBe(0)
    expect(result.longest).toBe(0)
    expect(result.todayUsed).toBe(false)
  })

  it('오늘만 사용 → current=1, longest=1', () => {
    const daily = [makeEntry('2026-05-22', 1000)]
    const result = calcStreak(daily, '2026-05-22')
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
    expect(result.todayUsed).toBe(true)
  })

  it('3일 연속 사용 (오늘 포함) → current=3, longest=3', () => {
    const daily = [
      makeEntry('2026-05-20', 1000),
      makeEntry('2026-05-21', 2000),
      makeEntry('2026-05-22', 3000),
    ]
    const result = calcStreak(daily, '2026-05-22')
    expect(result.current).toBe(3)
    expect(result.longest).toBe(3)
  })

  it('오늘 비어있고 어제까지 연속 → current 어제부터 카운트', () => {
    const daily = [
      makeEntry('2026-05-20', 1000),
      makeEntry('2026-05-21', 2000),
      // 2026-05-22 없음
    ]
    const result = calcStreak(daily, '2026-05-22')
    expect(result.current).toBe(2)
    expect(result.todayUsed).toBe(false)
  })

  it('중간에 끊긴 경우 → current는 최근 연속만', () => {
    const daily = [
      makeEntry('2026-05-01', 1000), // 끊김 (5/01 이후 비어있음)
      makeEntry('2026-05-20', 1000),
      makeEntry('2026-05-21', 2000),
      makeEntry('2026-05-22', 3000),
    ]
    const result = calcStreak(daily, '2026-05-22')
    expect(result.current).toBe(3)
    expect(result.longest).toBe(3) // 5/01은 단독
  })

  it('최장 스트릭은 끊긴 구간 중 가장 긴 것', () => {
    const daily = [
      // 5/01~5/05: 5일 연속
      makeEntry('2026-05-01', 1000),
      makeEntry('2026-05-02', 1000),
      makeEntry('2026-05-03', 1000),
      makeEntry('2026-05-04', 1000),
      makeEntry('2026-05-05', 1000),
      // 끊김
      makeEntry('2026-05-10', 1000),
      makeEntry('2026-05-11', 1000),
    ]
    const result = calcStreak(daily, '2026-05-11')
    expect(result.longest).toBe(5)
    expect(result.current).toBe(2)
  })

  it('1일만 있는 경우 → current=1, longest=1', () => {
    const daily = [makeEntry('2026-01-01', 1000)]
    const result = calcStreak(daily, '2026-01-01')
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
  })

  it('122일 모두 연속 → current=122, longest=122', () => {
    const daily: DailyEntry[] = []
    for (let i = 0; i < 122; i++) {
      daily.push(makeEntry(offsetDate('2026-01-20', i), 1000))
    }
    const lastDate = offsetDate('2026-01-20', 121)
    const result = calcStreak(daily, lastDate)
    expect(result.current).toBe(122)
    expect(result.longest).toBe(122)
  })
})

// ─────────────────────────────────────────────
// calcAchievements
// ─────────────────────────────────────────────

describe('calcAchievements', () => {
  it('기본: 12개 업적 반환', () => {
    const streak = { current: 0, longest: 0, todayUsed: false }
    const results = calcAchievements(0, 0, 0, streak, baseStats)
    expect(results.length).toBe(12)
  })

  it('토큰 0 → token_1m 업적 미해제', () => {
    const streak = { current: 0, longest: 0, todayUsed: false }
    const results = calcAchievements(0, 0, 0, streak, baseStats)
    const achievement = results.find((a) => a.id === 'token_1m')
    expect(achievement?.unlocked).toBe(false)
    expect(achievement?.progress).toBe(0)
  })

  it('1백만 토큰 → token_1m 해제', () => {
    const streak = { current: 0, longest: 0, todayUsed: false }
    const results = calcAchievements(1_000_000, 0, 0, streak, baseStats)
    const achievement = results.find((a) => a.id === 'token_1m')
    expect(achievement?.unlocked).toBe(true)
    expect(achievement?.progress).toBe(1)
  })

  it('$100 비용 → cost_100 해제', () => {
    const streak = { current: 0, longest: 0, todayUsed: false }
    const results = calcAchievements(0, 100, 0, streak, baseStats)
    const costAchievement = results.find((a) => a.id === 'cost_100')
    expect(costAchievement?.unlocked).toBe(true)
  })

  it('스트릭 7일 → streak_7 해제', () => {
    const streak = { current: 7, longest: 7, todayUsed: true }
    const results = calcAchievements(0, 0, 0, streak, baseStats)
    const streakAchievement = results.find((a) => a.id === 'streak_7')
    expect(streakAchievement?.unlocked).toBe(true)
  })

  it('스트릭 6일 → streak_7 미해제, progress ~0.857', () => {
    const streak = { current: 6, longest: 6, todayUsed: false }
    const results = calcAchievements(0, 0, 0, streak, baseStats)
    const streakAchievement = results.find((a) => a.id === 'streak_7')
    expect(streakAchievement?.unlocked).toBe(false)
    expect(streakAchievement?.progress).toBeCloseTo(6 / 7, 2)
  })

  it('progress는 항상 0~1 범위', () => {
    const streak = { current: 200, longest: 200, todayUsed: true }
    const results = calcAchievements(
      1_000_000_000_000,
      100000,
      200,
      streak,
      { ...baseStats, agentCount: 200, skillCount: 500 }
    )
    for (const a of results) {
      expect(a.progress).toBeGreaterThanOrEqual(0)
      expect(a.progress).toBeLessThanOrEqual(1)
    }
  })
})

// ─────────────────────────────────────────────
// calcGamification (통합)
// ─────────────────────────────────────────────

describe('calcGamification', () => {
  it('빈 daily + 기본 stats → 에러 없이 기본값 반환', () => {
    const result = calcGamification([], baseStats, '2026-05-22')
    expect(result.levelInfo.level).toBe(1)
    expect(result.streak.current).toBe(0)
    expect(result.achievements.length).toBeGreaterThan(0)
    expect(result.totalTokens).toBe(0)
    expect(result.totalCost).toBe(0)
    expect(result.totalDays).toBe(0)
  })

  it('실제 유사 데이터 (3일) → 올바른 집계', () => {
    const daily = [
      { period: '2026-05-20', totalTokens: 823_683_693, totalCost: 859.25 },
      { period: '2026-05-21', totalTokens: 2_231_014_660, totalCost: 1804.57 },
      { period: '2026-05-22', totalTokens: 403_180_094, totalCost: 378.29 },
    ]
    const result = calcGamification(daily, baseStats, '2026-05-22')
    expect(result.totalTokens).toBe(
      823_683_693 + 2_231_014_660 + 403_180_094
    )
    expect(result.totalDays).toBe(3)
    expect(result.streak.current).toBe(3)
    expect(result.levelInfo.level).toBeGreaterThan(1)
  })

  it('잘못된 daily 입력 → zod 에러 throw', () => {
    const invalid = [{ period: 'not-a-date', totalTokens: 'abc', totalCost: 0 }]
    expect(() => calcGamification(invalid, baseStats)).toThrow()
  })

  it('잘못된 stats 입력 → zod 에러 throw', () => {
    expect(() => calcGamification([], { agentCount: 'bad' })).toThrow()
  })
})
