/**
 * GamificationPanel.tsx — Claude Code 활동 현황 UI
 *
 * 비유: 활동 대시보드. 레벨/XP/스트릭/업적을 Palantir 다크 테마로 표시.
 * 자급자족 컴포넌트 — 내부에서 ccusage + system-data를 가져온다.
 */

import { memo, useEffect, useState, useMemo } from 'react'
import { api } from '../../lib/api'
import { useSystemDataContext } from '../../lib/DataProvider'
import {
  calcGamification,
  type GamificationResult,
  type Achievement,
  type AchievementTier,
} from '../../lib/gamification'

// ─────────────────────────────────────────────
// 색상 토큰 (Palantir 다크 테마 — StatCards.tsx 참조)
// ─────────────────────────────────────────────

const COLORS = {
  bg: '#1C2127',
  bgDeep: '#111418',
  bgSurface: '#252A31',
  border: '#404854',
  text: '#ABB3BF',
  textMuted: '#738091',
  textBright: '#F6F7F9',
  blue: '#2D72D2',
  green: '#29A634',
  gold: '#D1980B',
  purple: '#7961DB',
  teal: '#00A396',
  red: '#D33D17',
} as const

const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#C87533',
  silver: '#9DA5AD',
  gold: '#D1980B',
}

// ─────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────

/** XP 진행 바 */
function XpProgressBar({
  progressPercent,
  accentColor,
}: {
  progressPercent: number
  accentColor: string
}) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 6, backgroundColor: COLORS.bgDeep }}
    >
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{
          width: `${progressPercent}%`,
          background: `linear-gradient(90deg, ${accentColor}aa, ${accentColor})`,
          boxShadow: `0 0 8px ${accentColor}88`,
        }}
      />
    </div>
  )
}

/** 레벨 + 칭호 + XP 섹션 */
function LevelSection({ result }: { result: GamificationResult }) {
  const { levelInfo } = result
  const accent = COLORS.blue

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: `radial-gradient(ellipse at top left, ${accent}22 0%, transparent 60%), ${COLORS.bg}`,
        border: `1px solid ${accent}44`,
      }}
    >
      {/* 레벨 + 칭호 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg font-black text-3xl"
            style={{
              width: 60,
              height: 60,
              background: `linear-gradient(135deg, ${accent}44, ${accent}22)`,
              border: `2px solid ${accent}66`,
              color: accent,
            }}
          >
            {levelInfo.level}
          </div>
          <div className="flex flex-col">
            <span
              className="text-sm uppercase tracking-widest font-semibold"
              style={{ color: COLORS.textMuted }}
            >
              LEVEL {levelInfo.level}
            </span>
            <span
              className="text-xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${COLORS.textBright}, ${accent})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {levelInfo.title}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm" style={{ color: COLORS.textMuted }}>
            총 XP
          </span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: COLORS.textBright }}>
            {levelInfo.xp.toLocaleString()}
          </span>
        </div>
      </div>

      {/* XP 진행 바 */}
      <XpProgressBar progressPercent={levelInfo.progressPercent} accentColor={accent} />
      <div className="flex justify-between mt-1.5">
        <span className="text-[13px]" style={{ color: COLORS.textMuted }}>
          {levelInfo.xpForCurrentLevel.toLocaleString()} XP
        </span>
        <span className="text-[13px]" style={{ color: COLORS.textMuted }}>
          {levelInfo.progressPercent}% → Lv{levelInfo.level + 1} (
          {levelInfo.xpForNextLevel.toLocaleString()} XP)
        </span>
      </div>
    </div>
  )
}

/** 스트릭 카드 */
function StreakCard({ result }: { result: GamificationResult }) {
  const { streak } = result
  const isOnFire = streak.current >= 7

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${isOnFire ? '#D1980B55' : COLORS.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" style={{ color: COLORS.gold }}>
          {isOnFire ? '🔥' : '📅'}
        </span>
        <span className="text-sm uppercase tracking-widest font-semibold" style={{ color: COLORS.textMuted }}>
          스트릭
        </span>
        {streak.todayUsed && (
          <span
            className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${COLORS.green}22`, color: COLORS.green }}
          >
            오늘 사용
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <span className="text-4xl font-black tabular-nums" style={{ color: COLORS.textBright }}>
            {streak.current}
          </span>
          <span className="text-[13px]" style={{ color: COLORS.textMuted }}>
            현재 연속 일수
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-4xl font-black tabular-nums" style={{ color: COLORS.gold }}>
            {streak.longest}
          </span>
          <span className="text-[13px]" style={{ color: COLORS.textMuted }}>
            최장 기록
          </span>
        </div>
      </div>
    </div>
  )
}

/** 사용 요약 카드 */
function UsageSummaryCard({ result }: { result: GamificationResult }) {
  const { totalTokens, totalCost, totalDays } = result

  const items = [
    { label: '총 토큰', value: formatTokens(totalTokens), color: COLORS.teal, icon: '⚡' },
    { label: '누적 비용', value: `$${totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: COLORS.purple, icon: '💸' },
    { label: '활동 일수', value: `${totalDays}일`, color: COLORS.green, icon: '🗓' },
  ]

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <span className="text-sm uppercase tracking-widest font-semibold" style={{ color: COLORS.textMuted }}>
        사용 현황
      </span>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span style={{ color: item.color }}>{item.icon}</span>
              <span className="text-[13px]" style={{ color: COLORS.textMuted }}>
                {item.label}
              </span>
            </div>
            <span className="text-2xl font-bold tabular-nums" style={{ color: COLORS.textBright }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 단일 업적 아이템 */
function AchievementItem({ achievement }: { achievement: Achievement }) {
  const tierColor = TIER_COLORS[achievement.tier]
  const opacity = achievement.unlocked ? 1 : 0.45

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2 transition-all duration-200"
      style={{
        backgroundColor: achievement.unlocked ? `${tierColor}15` : COLORS.bgDeep,
        border: `1px solid ${achievement.unlocked ? `${tierColor}55` : COLORS.border}`,
        opacity,
      }}
    >
      {/* 아이콘 + 이름 */}
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none mt-0.5">
          {achievement.unlocked ? achievement.icon : '🔒'}
        </span>
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm font-semibold leading-snug"
            style={{ color: achievement.unlocked ? COLORS.textBright : COLORS.textMuted }}
          >
            {achievement.name}
          </span>
          <span
            className="text-xs mt-0.5 leading-snug"
            style={{ color: COLORS.textMuted, opacity: 0.85 }}
          >
            {achievement.description}
          </span>
        </div>
      </div>

      {/* 진행률 바 (미해제 시) */}
      {!achievement.unlocked && (
        <div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 3, backgroundColor: COLORS.bgSurface }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round(achievement.progress * 100)}%`,
                backgroundColor: tierColor,
              }}
            />
          </div>
          <span className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
            {Math.round(achievement.progress * 100)}%
          </span>
        </div>
      )}

      {/* 티어 배지 */}
      <div className="flex justify-end">
        <span
          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: `${tierColor}22`,
            color: tierColor,
            letterSpacing: '0.1em',
          }}
        >
          {achievement.tier}
        </span>
      </div>
    </div>
  )
}

/** 업적 그리드 */
function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const unlocked = useMemo(
    () => achievements.filter((a) => a.unlocked),
    [achievements]
  )
  const locked = useMemo(
    () => achievements.filter((a) => !a.unlocked),
    [achievements]
  )

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm uppercase tracking-widest font-semibold" style={{ color: COLORS.textMuted }}>
          업적
        </span>
        <span
          className="text-sm font-bold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${COLORS.gold}22`,
            color: COLORS.gold,
          }}
        >
          {unlocked.length} / {achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {/* 해제된 업적 먼저 */}
        {[...unlocked, ...locked].map((a) => (
          <AchievementItem key={a.id} achievement={a} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; result: GamificationResult }
  | { status: 'error'; message: string }

const GamificationPanel = memo(function GamificationPanel() {
  const { systemData } = useSystemDataContext()
  const [state, setState] = useState<LoadState>({ status: 'idle' })

  useEffect(() => {
    setState({ status: 'loading' })

    api
      .fetchCcusageDaily()
      .then((raw) => {
        const data = raw as { daily?: unknown[]; error?: string }
        const daily = data?.daily ?? []

        if (!Array.isArray(daily)) {
          setState({ status: 'error', message: 'ccusage 데이터 형식 오류' })
          return
        }

        const systemStats = {
          agentCount: systemData.stats.agentCount,
          skillCount: systemData.stats.skillCount,
          hookCount: systemData.stats.hookCount,
          ruleCount: systemData.stats.ruleCount,
          pipelineCount: systemData.stats.pipelineCount,
          mcpServerCount: systemData.stats.mcpServerCount,
        }

        const result = calcGamification(daily, systemStats)
        setState({ status: 'ok', result })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [systemData.stats])

  // ─── 로딩 ───
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div
        className="rounded-xl p-6 flex items-center justify-center"
        style={{
          backgroundColor: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
          minHeight: 200,
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-block text-3xl"
            style={{ animation: 'spin 1.2s linear infinite' }}
          >
            ⟳
          </span>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <span className="text-base" style={{ color: COLORS.textMuted }}>
            활동 데이터 로딩 중...
          </span>
        </div>
      </div>
    )
  }

  // ─── 에러 ───
  if (state.status === 'error') {
    return (
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: COLORS.bg,
          border: `1px solid ${COLORS.red}44`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: COLORS.red }}>⚠</span>
          <span className="text-base font-semibold" style={{ color: COLORS.textBright }}>
            활동 데이터 로드 실패
          </span>
        </div>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          ccusage 데이터를 가져오지 못했어요. Tauri 환경에서만 동작합니다.
        </p>
        <p className="text-sm mt-1 font-mono" style={{ color: COLORS.red }}>
          {state.message}
        </p>
      </div>
    )
  }

  // ─── 성공 ───
  const { result } = state

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <span className="text-lg" style={{ color: COLORS.gold }}>
          📊
        </span>
        <span
          className="text-sm uppercase tracking-[0.18em] font-semibold"
          style={{ color: COLORS.textMuted }}
        >
          Claude Code 활동 현황
        </span>
        <div
          className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${COLORS.green}22`,
            color: COLORS.green,
          }}
        >
          ● LIVE
        </div>
      </div>

      {/* 레벨 섹션 */}
      <LevelSection result={result} />

      {/* 스트릭 + 사용 현황 2열 */}
      <div className="grid grid-cols-2 gap-4">
        <StreakCard result={result} />
        <UsageSummaryCard result={result} />
      </div>

      {/* 업적 그리드 */}
      <AchievementsGrid achievements={result.achievements} />
    </div>
  )
})

export { GamificationPanel }

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
