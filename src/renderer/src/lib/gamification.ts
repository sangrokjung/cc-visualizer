/**
 * gamification.ts — Claude Code 사용 활동 현황 순수 로직
 *
 * 비유: 활동 점수 "스탯 계산기". UI 없이 순수하게 레벨/XP/스트릭/업적을 계산.
 * 입력: ccusage daily 배열 + system-data 통계
 * 출력: 레벨, XP, 스트릭, 업적 목록 (불변 객체)
 */

import { z } from 'zod'

// ─────────────────────────────────────────────
// 1. zod 스키마 (경계 검증)
// ─────────────────────────────────────────────

/** ccusage daily 항목 스키마 */
export const DailyEntrySchema = z.object({
  period: z.string(), // "YYYY-MM-DD"
  totalTokens: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
  cacheReadTokens: z.number().nonnegative().optional(),
  cacheCreationTokens: z.number().nonnegative().optional(),
  metadata: z.object({
    agents: z.array(z.string()).optional(),
  }).optional(),
})
export type DailyEntry = z.infer<typeof DailyEntrySchema>

/** system-data 통계 스키마 (활동 현황에 필요한 필드만) */
export const SystemStatsSchema = z.object({
  agentCount: z.number().nonnegative(),
  skillCount: z.number().nonnegative(),
  hookCount: z.number().nonnegative(),
  ruleCount: z.number().nonnegative(),
  pipelineCount: z.number().nonnegative(),
  mcpServerCount: z.number().nonnegative(),
})
export type SystemStats = z.infer<typeof SystemStatsSchema>

/** 업적 티어 */
export const AchievementTierSchema = z.enum(['bronze', 'silver', 'gold'])
export type AchievementTier = z.infer<typeof AchievementTierSchema>

/** 단일 업적 */
export const AchievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(), // 이모지
  tier: AchievementTierSchema,
  unlocked: z.boolean(),
  progress: z.number().min(0).max(1), // 0~1 진행률
  target: z.number().positive(),
  current: z.number().nonnegative(),
})
export type Achievement = z.infer<typeof AchievementSchema>

/** 스트릭 정보 */
export const StreakInfoSchema = z.object({
  current: z.number().nonnegative(),
  longest: z.number().nonnegative(),
  todayUsed: z.boolean(),
})
export type StreakInfo = z.infer<typeof StreakInfoSchema>

/** 레벨 정보 */
export const LevelInfoSchema = z.object({
  level: z.number().positive(),
  xp: z.number().nonnegative(),
  xpForCurrentLevel: z.number().nonnegative(),
  xpForNextLevel: z.number().positive(),
  progressPercent: z.number().min(0).max(100),
  title: z.string(), // 칭호
})
export type LevelInfo = z.infer<typeof LevelInfoSchema>

/** 활동 현황 전체 결과 */
export const GamificationResultSchema = z.object({
  levelInfo: LevelInfoSchema,
  streak: StreakInfoSchema,
  achievements: z.array(AchievementSchema),
  totalTokens: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  totalDays: z.number().nonnegative(),
})
export type GamificationResult = z.infer<typeof GamificationResultSchema>

// ─────────────────────────────────────────────
// 2. XP / 레벨 계산
// ─────────────────────────────────────────────

/**
 * 총 토큰에서 XP를 계산한다.
 * 공식: 1억 토큰 = 1000 XP (10만 토큰당 1 XP)
 * 소규모 사용자도 초반 레벨업을 경험하도록 설계.
 */
export function calcXP(totalTokens: number): number {
  return Math.floor(totalTokens / 100_000)
}

/**
 * 비용 기반 XP 보너스 (누적 지출 $100 = +100 XP).
 * 토큰 XP와 합산하여 실제 투자 반영.
 */
export function calcCostXP(totalCost: number): number {
  return Math.floor(totalCost)
}

/** 레벨 구간별 필요 XP (누적). 비선형 곡선으로 레벨업이 점점 어려워짐. */
const LEVEL_THRESHOLDS: readonly number[] = [
  0,      // Lv 1 시작
  100,    // Lv 2
  250,    // Lv 3
  500,    // Lv 4
  900,    // Lv 5
  1500,   // Lv 6
  2400,   // Lv 7
  3700,   // Lv 8
  5500,   // Lv 9
  8000,   // Lv 10
  11500,  // Lv 11
  16000,  // Lv 12
  22000,  // Lv 13 (퀀텀 마스터)
]

/** XP로 레벨 계산. 최대 레벨은 LEVEL_THRESHOLDS 길이 기준. */
export function calcLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

/** 레벨별 필요 XP (현재 레벨 시작 XP ~ 다음 레벨 XP) */
export function getLevelBounds(level: number): { start: number; end: number } {
  const idx = level - 1
  const start = LEVEL_THRESHOLDS[idx] ?? 0
  const end = LEVEL_THRESHOLDS[idx + 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2
  return { start, end }
}

/** 레벨별 칭호 (한국어 + 위트) */
const LEVEL_TITLES: Readonly<Record<number, string>> = {
  1: '수습 빌더',
  2: '코드 병아리',
  3: '자동화 입문자',
  4: '스크립트 마법사',
  5: '에이전트 조련사',
  6: '파이프라인 연금술사',
  7: '시스템 설계사',
  8: '오케스트레이터',
  9: '퀀텀 점프어',
  10: '특이점 빌더',
  11: '자가학습 아키텍트',
  12: '자율 오토메이터',
  13: '퀀텀 마스터',
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? LEVEL_TITLES[13]
}

/** 레벨 정보 전체 계산 */
export function calcLevelInfo(totalTokens: number, totalCost: number): LevelInfo {
  const xp = calcXP(totalTokens) + calcCostXP(totalCost)
  const level = calcLevel(xp)
  const { start, end } = getLevelBounds(level)
  const xpInLevel = xp - start
  const xpNeeded = end - start
  const progressPercent = xpNeeded > 0 ? Math.min(Math.round((xpInLevel / xpNeeded) * 100), 100) : 100

  return LevelInfoSchema.parse({
    level,
    xp,
    xpForCurrentLevel: start,
    xpForNextLevel: end,
    progressPercent,
    title: getLevelTitle(level),
  })
}

// ─────────────────────────────────────────────
// 3. 스트릭 계산
// ─────────────────────────────────────────────

/**
 * ccusage daily 배열에서 연속 사용일(스트릭)을 계산한다.
 * 오늘 날짜(referenceDate)부터 역순으로 끊기지 않은 연속 날짜를 센다.
 */
export function calcStreak(
  daily: readonly DailyEntry[],
  referenceDate?: string
): StreakInfo {
  if (daily.length === 0) {
    return StreakInfoSchema.parse({ current: 0, longest: 0, todayUsed: false })
  }

  // 사용된 날짜 Set (YYYY-MM-DD)
  const usedDates = new Set(daily.map((d) => d.period))

  // 참조 날짜 (기본: 오늘)
  const today = referenceDate ?? new Date().toISOString().slice(0, 10)

  // 오늘 사용 여부
  const todayUsed = usedDates.has(today)

  // 현재 스트릭: 오늘 또는 어제부터 역순으로 연속된 날 카운트
  let currentStreak = 0
  const startDate = todayUsed ? today : offsetDate(today, -1)

  if (usedDates.has(startDate)) {
    let checkDate = startDate
    while (usedDates.has(checkDate)) {
      currentStreak++
      checkDate = offsetDate(checkDate, -1)
    }
  }

  // 최장 스트릭: 전체 날짜 정렬 후 연속 카운트
  const sorted = [...usedDates].sort()
  let longest = 0
  let runLength = 0
  let prevDate: string | null = null

  for (const date of sorted) {
    if (prevDate === null || offsetDate(prevDate, 1) === date) {
      runLength++
    } else {
      runLength = 1
    }
    longest = Math.max(longest, runLength)
    prevDate = date
  }

  return StreakInfoSchema.parse({
    current: currentStreak,
    longest,
    todayUsed,
  })
}

/** YYYY-MM-DD 날짜를 N일 이동한 날짜 문자열 반환 */
export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────
// 4. 업적 정의 + 판정
// ─────────────────────────────────────────────

interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  tier: AchievementTier
  target: number
  /** 현재 값 추출 함수 */
  getValue: (
    totalTokens: number,
    totalCost: number,
    totalDays: number,
    streak: StreakInfo,
    systemStats: SystemStats
  ) => number
}

const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  // 토큰 마일스톤
  {
    id: 'token_1m',
    name: '첫 백만 토큰',
    description: '누적 100만 토큰을 소비했어요. 이제 진짜 시작이네요!',
    icon: '🌱',
    tier: 'bronze',
    target: 1_000_000,
    getValue: (tt) => tt,
  },
  {
    id: 'token_100m',
    name: '1억 토큰 클럽',
    description: '1억 토큰 돌파! 토큰 소비량이 엄청나네요.',
    icon: '💫',
    tier: 'silver',
    target: 100_000_000,
    getValue: (tt) => tt,
  },
  {
    id: 'token_10b',
    name: '100억 토큰 전설',
    description: '100억 토큰을 소모했습니다. 전설의 영역에 진입!',
    icon: '⚡',
    tier: 'gold',
    target: 10_000_000_000,
    getValue: (tt) => tt,
  },
  // 비용 마일스톤
  {
    id: 'cost_100',
    name: '$100 투자자',
    description: 'Claude Code에 $100 이상을 투자했어요. 진지한 빌더입니다.',
    icon: '💰',
    tier: 'bronze',
    target: 100,
    getValue: (_tt, tc) => tc,
  },
  {
    id: 'cost_1000',
    name: '$1,000 클럽',
    description: '누적 지출 $1,000! 진정한 자동화 투자자.',
    icon: '🏦',
    tier: 'silver',
    target: 1000,
    getValue: (_tt, tc) => tc,
  },
  {
    id: 'cost_10000',
    name: '$10,000 파워 유저',
    description: '1만 달러 달성! 당신의 자동화는 남다릅니다.',
    icon: '👑',
    tier: 'gold',
    target: 10000,
    getValue: (_tt, tc) => tc,
  },
  // 스트릭 업적
  {
    id: 'streak_7',
    name: '7일 연속 빌더',
    description: '7일 연속 Claude Code를 사용했어요. 습관이 만들어지는 중!',
    icon: '🔥',
    tier: 'bronze',
    target: 7,
    getValue: (_tt, _tc, _td, streak) => streak.longest,
  },
  {
    id: 'streak_30',
    name: '30일 마라토너',
    description: '30일 연속 달성! 이제 진짜 루틴이 생겼네요.',
    icon: '🏃',
    tier: 'silver',
    target: 30,
    getValue: (_tt, _tc, _td, streak) => streak.longest,
  },
  {
    id: 'streak_100',
    name: '100일의 기적',
    description: '100일 연속 사용. 당신은 자동화 수행자입니다.',
    icon: '🏆',
    tier: 'gold',
    target: 100,
    getValue: (_tt, _tc, _td, streak) => streak.longest,
  },
  // 시스템 다양성
  {
    id: 'agent_10',
    name: '에이전트 조련사',
    description: '10개 이상의 에이전트를 시스템에 구축했어요.',
    icon: '🤖',
    tier: 'bronze',
    target: 10,
    getValue: (_tt, _tc, _td, _streak, stats) => stats.agentCount,
  },
  {
    id: 'skill_50',
    name: '스킬 수집가',
    description: '50개 이상의 스킬을 보유 중입니다.',
    icon: '🎯',
    tier: 'silver',
    target: 50,
    getValue: (_tt, _tc, _td, _streak, stats) => stats.skillCount,
  },
  // 활동 기간
  {
    id: 'days_30',
    name: '30일 활동 유저',
    description: '30일 이상 Claude Code를 사용한 날이 있어요.',
    icon: '📅',
    tier: 'bronze',
    target: 30,
    getValue: (_tt, _tc, td) => td,
  },
]

/** 단일 업적 판정 (현재 값 기반) */
export function evaluateAchievement(
  def: AchievementDefinition,
  totalTokens: number,
  totalCost: number,
  totalDays: number,
  streak: StreakInfo,
  systemStats: SystemStats
): Achievement {
  const current = def.getValue(totalTokens, totalCost, totalDays, streak, systemStats)
  const unlocked = current >= def.target
  const progress = Math.min(current / def.target, 1)

  return AchievementSchema.parse({
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    tier: def.tier,
    unlocked,
    progress,
    target: def.target,
    current,
  })
}

/** 모든 업적 판정 */
export function calcAchievements(
  totalTokens: number,
  totalCost: number,
  totalDays: number,
  streak: StreakInfo,
  systemStats: SystemStats
): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((def) =>
    evaluateAchievement(def, totalTokens, totalCost, totalDays, streak, systemStats)
  )
}

// ─────────────────────────────────────────────
// 5. 통합 계산 (메인 진입점)
// ─────────────────────────────────────────────

/**
 * ccusage daily 배열 + system stats를 받아 활동 현황 결과 전체를 반환한다.
 * 순수 함수: 동일 입력 → 동일 출력.
 */
export function calcGamification(
  daily: unknown[],
  systemStats: unknown,
  referenceDate?: string
): GamificationResult {
  // zod 경계 검증
  const parsedDaily = daily.map((d) => DailyEntrySchema.parse(d))
  const parsedStats = SystemStatsSchema.parse(systemStats)

  const totalTokens = parsedDaily.reduce((sum, d) => sum + d.totalTokens, 0)
  const totalCost = parsedDaily.reduce((sum, d) => sum + d.totalCost, 0)
  const totalDays = parsedDaily.length

  const levelInfo = calcLevelInfo(totalTokens, totalCost)
  const streak = calcStreak(parsedDaily, referenceDate)
  const achievements = calcAchievements(totalTokens, totalCost, totalDays, streak, parsedStats)

  return GamificationResultSchema.parse({
    levelInfo,
    streak,
    achievements,
    totalTokens,
    totalCost,
    totalDays,
  })
}
