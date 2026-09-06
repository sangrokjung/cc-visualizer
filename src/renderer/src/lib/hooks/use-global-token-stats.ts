import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import {
  buildTokenStats,
  type CcusageEntry,
  type CcusageTotals,
  type PeriodTotal,
  type DailyPoint,
  type ModelUsage,
  type ProviderUsage,
} from '../token-aggregation'

// ccusage 집계 — 오늘/어제/이번주/이번달/누적.
// 데이터 소스: ~/.claude/projects/**/*.jsonl (ccusage가 파싱).
// 정확성: 주간/월간/누적은 ccusage native weekly/monthly 명령(= CLI 출력과 정확히 일치)을 쓰고,
// 실패 시 daily에서 파생한다(buildTokenStats 내부 폴백). daily는 오늘/어제/14일 추이 전용.

export type { DailyPoint } from '../token-aggregation'

// 하위호환 — 일부 소비처가 이 타입명을 import 할 수 있어 유지.
export type DailyEntry = CcusageEntry

export type GlobalTokenStats = {
  today: { tokens: number; cost: number } | null
  yesterday: { tokens: number; cost: number } | null
  thisWeek: PeriodTotal // 이번 주 (월요일 시작) — native weekly
  thisMonth: PeriodTotal // 이번 달 (YYYY-MM) — native monthly
  weekly: { tokens: number; cost: number; days: number } // 최근 7일 롤링 (하위호환)
  allTime: { tokens: number; cost: number; days: number } // 전체 누적 — monthly totals
  todayVsYesterday: number | null
  recentDaily: DailyPoint[] // 최근 14일 추이 (오름차순)
  modelBreakdown: ModelUsage[] // 이번 달 모델별 (codex 포함)
  providerBreakdown: ProviderUsage[] // 이번 달 제공자별
  loading: boolean
  error: string | null
  refresh: () => void
}

const EMPTY: PeriodTotal = { tokens: 0, cost: 0, days: 0 }

const EMPTY_STATS: Omit<GlobalTokenStats, 'refresh'> = {
  today: null,
  yesterday: null,
  thisWeek: EMPTY,
  thisMonth: EMPTY,
  weekly: EMPTY,
  allTime: EMPTY,
  todayVsYesterday: null,
  recentDaily: [],
  modelBreakdown: [],
  providerBreakdown: [],
  loading: false,
  error: null,
}

// ccusage 응답에서 엔트리 배열 안전 추출
function asEntries(raw: unknown, key: 'daily' | 'weekly' | 'monthly'): CcusageEntry[] {
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as Record<string, unknown>)[key]
  return Array.isArray(arr) ? (arr as CcusageEntry[]) : []
}

function asTotals(raw: unknown): CcusageTotals | null {
  if (!raw || typeof raw !== 'object') return null
  const t = (raw as { totals?: unknown }).totals
  if (!t || typeof t !== 'object') return null
  const o = t as { totalTokens?: number; totalCost?: number }
  if (typeof o.totalTokens === 'number' && typeof o.totalCost === 'number') {
    return { totalTokens: o.totalTokens, totalCost: o.totalCost }
  }
  return null
}

export function useGlobalTokenStats(): GlobalTokenStats {
  const [stats, setStats] = useState<Omit<GlobalTokenStats, 'refresh'>>({ ...EMPTY_STATS, loading: true })

  const load = useCallback(async () => {
    // '지금'을 await 전에 캡처 — fetch가 자정 경계를 넘겨 끝나면 주/월 키가 어긋나
    // native weekly/monthly 매칭이 깨지고 daily 파생으로 새는 race를 방지.
    const now = new Date()
    setStats((s) => ({ ...s, loading: true, error: null }))
    try {
      // daily는 필수, weekly/monthly는 정확도 향상용(실패 시 daily 파생 폴백).
      const [dailyRaw, weeklyRaw, monthlyRaw] = await Promise.all([
        api.fetchCcusageDaily(),
        api.fetchCcusageWeekly().catch(() => ({ weekly: [] })),
        api.fetchCcusageMonthly().catch(() => ({ monthly: [] })),
      ])

      const dailyErr = (dailyRaw as { error?: string }).error
      if (dailyErr) throw new Error(dailyErr)

      const built = buildTokenStats(
        {
          daily: asEntries(dailyRaw, 'daily'),
          weekly: asEntries(weeklyRaw, 'weekly'),
          monthly: asEntries(monthlyRaw, 'monthly'),
          monthlyTotals: asTotals(monthlyRaw),
        },
        now,
      )

      setStats({ ...built, loading: false, error: null })
    } catch (e) {
      setStats({ ...EMPTY_STATS, error: String(e) })
    }
  }, [])

  useEffect(() => {
    load()
    // 5분마다 자동 refresh (ccusage 자체 캐시로 부담 적음)
    const id = setInterval(load, 5 * 60_000)
    return () => clearInterval(id)
  }, [load])

  return { ...stats, refresh: load }
}
