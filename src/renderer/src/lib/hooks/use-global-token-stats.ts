import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

// ccusage 일자별 stats — 오늘/어제/주간 집계
// 데이터 소스: ~/.claude/projects/**/*.jsonl (ccusage가 알아서 파싱)
// agent 필터: claude 모델만 (codex/opencode 등 제외)

export type DailyEntry = {
  period: string // 'YYYY-MM-DD'
  totalTokens: number
  totalCost: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  modelsUsed: string[]
  metadata?: { agents?: string[] }
}

export type GlobalTokenStats = {
  today: { tokens: number; cost: number } | null
  yesterday: { tokens: number; cost: number } | null
  weekly: { tokens: number; cost: number; days: number }
  allTime: { tokens: number; cost: number; days: number }
  todayVsYesterday: number | null // 변화율 (% — 양수면 오늘 더 씀)
  loading: boolean
  error: string | null
  refresh: () => void
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function last7Keys(): Set<string> {
  const keys = new Set<string>()
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return keys
}

// Claude 모델만 필터 — agent metadata 또는 modelsUsed 검사
function isClaudeEntry(e: DailyEntry): boolean {
  const agents = e.metadata?.agents ?? []
  if (agents.some((a) => a.toLowerCase().includes('claude'))) return true
  return e.modelsUsed.some((m) => m.toLowerCase().includes('claude'))
}

const EMPTY_STATS: Omit<GlobalTokenStats, 'refresh'> = {
  today: null,
  yesterday: null,
  weekly: { tokens: 0, cost: 0, days: 0 },
  allTime: { tokens: 0, cost: 0, days: 0 },
  todayVsYesterday: null,
  loading: false,
  error: null,
}

export function useGlobalTokenStats(): GlobalTokenStats {
  const [stats, setStats] = useState<Omit<GlobalTokenStats, 'refresh'>>({ ...EMPTY_STATS, loading: true })

  const load = useCallback(async () => {
    // Tauri context 없으면 빈 stats
    if (typeof window === 'undefined' || !(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
      setStats({ ...EMPTY_STATS })
      return
    }
    setStats((s) => ({ ...s, loading: true, error: null }))
    try {
      const raw = (await api.fetchCcusageDaily()) as { daily?: DailyEntry[]; error?: string }
      if (raw.error) throw new Error(raw.error)
      const daily = (raw.daily ?? []).filter(isClaudeEntry)
      const todayK = todayKey()
      const yK = yesterdayKey()
      const week = last7Keys()

      let today: { tokens: number; cost: number } | null = null
      let yesterday: { tokens: number; cost: number } | null = null
      let weeklyT = 0
      let weeklyC = 0
      let weekDays = 0
      let allT = 0
      let allC = 0

      for (const e of daily) {
        allT += e.totalTokens
        allC += e.totalCost
        if (e.period === todayK) today = { tokens: e.totalTokens, cost: e.totalCost }
        if (e.period === yK) yesterday = { tokens: e.totalTokens, cost: e.totalCost }
        if (week.has(e.period)) {
          weeklyT += e.totalTokens
          weeklyC += e.totalCost
          weekDays++
        }
      }

      const todayVsYesterday = today && yesterday && yesterday.cost > 0
        ? ((today.cost - yesterday.cost) / yesterday.cost) * 100
        : null

      setStats({
        today,
        yesterday,
        weekly: { tokens: weeklyT, cost: weeklyC, days: weekDays },
        allTime: { tokens: allT, cost: allC, days: daily.length },
        todayVsYesterday,
        loading: false,
        error: null,
      })
    } catch (e) {
      setStats({ ...EMPTY_STATS, error: String(e) })
    }
  }, [])

  useEffect(() => {
    load()
    // 5분마다 자동 refresh (ccusage가 자체 캐시 사용해서 부담 적음)
    const id = setInterval(load, 5 * 60_000)
    return () => clearInterval(id)
  }, [load])

  return { ...stats, refresh: load }
}
