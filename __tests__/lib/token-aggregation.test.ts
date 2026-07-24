import { describe, it, expect } from 'vitest'
import {
  dateKey,
  monthKey,
  mondayKey,
  isClaudeEntry,
  buildTokenStats,
  providerOf,
  modelLabel,
  aggregateModels,
  aggregateProviders,
  type CcusageEntry,
  type ModelBreakdownRaw,
} from '../../src/renderer/src/lib/token-aggregation'

function entry(period: string, tokens: number, cost: number): CcusageEntry {
  return {
    period,
    totalTokens: tokens,
    totalCost: cost,
    inputTokens: Math.round(tokens * 0.1),
    outputTokens: Math.round(tokens * 0.05),
    metadata: { agents: ['claude'] },
  }
}

describe('token-aggregation 날짜 헬퍼', () => {
  it('1: dateKey — 로컬 YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 5, 20))).toBe('2026-06-20')
    expect(dateKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('2: monthKey — YYYY-MM', () => {
    expect(monthKey(new Date(2026, 5, 20))).toBe('2026-06')
  })

  it('3: mondayKey — 토요일(6/20)이면 그 주 월요일 6/15', () => {
    expect(mondayKey(new Date(2026, 5, 20))).toBe('2026-06-15')
  })

  it('4: mondayKey — 일요일이면 직전 월요일(같은 주 시작)', () => {
    // 2026-06-21 은 일요일 → 같은 주 월요일은 6/15
    expect(mondayKey(new Date(2026, 5, 21))).toBe('2026-06-15')
  })

  it('5: mondayKey — 월요일이면 자기 자신', () => {
    expect(mondayKey(new Date(2026, 5, 15))).toBe('2026-06-15')
  })
})

describe('isClaudeEntry 필터', () => {
  it('6: agents에 claude 포함 → true', () => {
    expect(isClaudeEntry(entry('2026-06-20', 1, 1))).toBe(true)
  })

  it('7: 메타 없음 → graceful true', () => {
    const e: CcusageEntry = { period: '2026-06-20', totalTokens: 1, totalCost: 1, inputTokens: 0, outputTokens: 0 }
    expect(isClaudeEntry(e)).toBe(true)
  })

  it('8: 다른 모델만 있고 claude 없음 → false', () => {
    const e: CcusageEntry = {
      period: '2026-06-20', totalTokens: 1, totalCost: 1, inputTokens: 0, outputTokens: 0,
      modelsUsed: ['gpt-5.5'], metadata: { agents: ['codex'] },
    }
    expect(isClaudeEntry(e)).toBe(false)
  })
})

describe('buildTokenStats — native weekly/monthly 우선', () => {
  const now = new Date(2026, 5, 20) // 토요일
  const daily: CcusageEntry[] = [
    entry('2026-06-14', 100, 10), // 지난 주(일)
    entry('2026-06-15', 200, 20), // 이번 주 월
    entry('2026-06-19', 300, 30), // 어제
    entry('2026-06-20', 400, 40), // 오늘
  ]

  it('9: today/yesterday 정확', () => {
    const s = buildTokenStats({ daily }, now)
    expect(s.today).toEqual({ tokens: 400, cost: 40 })
    expect(s.yesterday).toEqual({ tokens: 300, cost: 30 })
  })

  it('10: native weekly 있으면 그 값(CLI 패리티) 사용', () => {
    const weekly: CcusageEntry[] = [entry('2026-06-15', 9999, 999.5)]
    const s = buildTokenStats({ daily, weekly }, now)
    expect(s.thisWeek.cost).toBe(999.5)
    expect(s.thisWeek.tokens).toBe(9999)
  })

  it('11: native weekly 없으면 daily 파생(월요일 시작 이후 합)', () => {
    const s = buildTokenStats({ daily }, now)
    // 6/15(20) + 6/19(30) + 6/20(40) = 90, 6/14 제외
    expect(s.thisWeek.cost).toBe(90)
    expect(s.thisWeek.tokens).toBe(900)
  })

  it('12: native monthly 있으면 그 값 사용', () => {
    const monthly: CcusageEntry[] = [entry('2026-06', 88888, 8888.25)]
    const s = buildTokenStats({ daily, monthly }, now)
    expect(s.thisMonth.cost).toBe(8888.25)
    expect(s.thisMonth.tokens).toBe(88888)
  })

  it('13: native monthly 없으면 daily 파생(YYYY-MM 합)', () => {
    const s = buildTokenStats({ daily }, now)
    // 6월 전부: 10+20+30+40 = 100
    expect(s.thisMonth.cost).toBe(100)
    expect(s.thisMonth.tokens).toBe(1000)
  })

  it('14: allTime — monthlyTotals 우선(정확)', () => {
    const s = buildTokenStats({ daily, monthlyTotals: { totalTokens: 123456, totalCost: 26692.74 } }, now)
    expect(s.allTime.cost).toBeCloseTo(26692.74, 2)
    expect(s.allTime.tokens).toBe(123456)
    expect(s.allTime.days).toBe(4) // 활동 일수는 daily 길이
  })

  it('15: allTime — monthlyTotals 없으면 daily 합산 폴백', () => {
    const s = buildTokenStats({ daily }, now)
    expect(s.allTime.cost).toBe(100)
  })

  it('16: 최근 7일 롤링 weekly(하위호환) — 6/14 포함', () => {
    const s = buildTokenStats({ daily }, now)
    // 6/14..6/20 전부 = 100 (롤링 7일은 6/14 포함)
    expect(s.weekly.cost).toBe(100)
  })

  it('17: todayVsYesterday — (40-30)/30*100 ≈ 33.3%', () => {
    const s = buildTokenStats({ daily }, now)
    expect(s.todayVsYesterday).toBeCloseTo(33.33, 1)
  })

  it('18: recentDaily — period 오름차순, 최대 14개', () => {
    const s = buildTokenStats({ daily }, now)
    expect(s.recentDaily.map((d) => d.period)).toEqual([
      '2026-06-14', '2026-06-15', '2026-06-19', '2026-06-20',
    ])
  })

  it('19: 이번 주/달에 활동 없으면 0 (과거 native 엔트리로 새지 않음)', () => {
    const empty: CcusageEntry[] = []
    const weekly: CcusageEntry[] = [entry('2026-06-08', 5, 5)] // 지난 주만
    const monthly: CcusageEntry[] = [entry('2026-05', 5, 5)] // 지난 달만
    const s = buildTokenStats({ daily: empty, weekly, monthly }, now)
    expect(s.thisWeek.cost).toBe(0)
    expect(s.thisMonth.cost).toBe(0)
  })

  it('20: 빈 입력 → 안전한 기본값', () => {
    const s = buildTokenStats({ daily: [] }, now)
    expect(s.today).toBeNull()
    expect(s.thisWeek.cost).toBe(0)
    expect(s.thisMonth.cost).toBe(0)
    expect(s.allTime.cost).toBe(0)
    expect(s.recentDaily).toEqual([])
  })

  it('21: daily 미필터 — 비-claude(codex) 엔트리도 카운트 (CLI 패리티, Swift와 일치)', () => {
    const codexDay: CcusageEntry = {
      period: '2026-06-20', totalTokens: 500, totalCost: 50,
      inputTokens: 10, outputTokens: 5, modelsUsed: ['gpt-5.5'], metadata: { agents: ['codex'] },
    }
    const s = buildTokenStats({ daily: [codexDay] }, now)
    // 이전엔 isClaudeEntry로 제외됐으나, 이제 ccusage CLI처럼 전부 포함 → today에 반영
    expect(s.today).toEqual({ tokens: 500, cost: 50 })
    expect(s.thisMonth.cost).toBe(50)
  })

  it('22: allTime — monthlyTotals 비용 0이어도 totals 객체 있으면 사용 (Swift hasTotals와 동일)', () => {
    const s = buildTokenStats({ daily: [], monthlyTotals: { totalTokens: 0, totalCost: 0 } }, now)
    expect(s.allTime.cost).toBe(0)
    expect(s.allTime.tokens).toBe(0)
  })
})

describe('providerOf — codex 추적 분류', () => {
  it('23: claude → Claude', () => {
    expect(providerOf('claude-opus-4-8')).toBe('Claude')
    expect(providerOf('claude-fable-5')).toBe('Claude')
  })
  it('24: gpt/codex → Codex (핵심)', () => {
    expect(providerOf('gpt-5.5')).toBe('Codex')
    expect(providerOf('gpt-5-codex')).toBe('Codex')
    expect(providerOf('gpt-5.1-codex-max')).toBe('Codex')
    expect(providerOf('gpt-5.4-mini')).toBe('Codex')
  })
  it('25: gemini → Gemini', () => {
    expect(providerOf('gemini-2.5-pro')).toBe('Gemini')
    expect(providerOf('antigravity-gemini-3-pro-high')).toBe('Gemini')
  })
  it('26: minimax/glm/unknown', () => {
    expect(providerOf('minimax/MiniMax-M2.5')).toBe('MiniMax')
    expect(providerOf('glm-4.7-free')).toBe('GLM')
    expect(providerOf('something-else')).toBe('Other')
  })
})

describe('modelLabel — 표시명', () => {
  it('27: claude tier 버전', () => {
    expect(modelLabel('claude-opus-4-8')).toBe('Opus 4.8')
    expect(modelLabel('claude-sonnet-4-6')).toBe('Sonnet 4.6')
    expect(modelLabel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5') // 날짜 접미사 제거
    expect(modelLabel('claude-fable-5')).toBe('Fable 5') // 단일 버전 모델도 처리
  })
  it('28: gpt/codex', () => {
    expect(modelLabel('gpt-5.5')).toBe('GPT-5.5')
    expect(modelLabel('gpt-5-codex')).toBe('GPT-5 Codex')
    expect(modelLabel('gpt-5.1-codex-max')).toBe('GPT-5.1 Codex Max')
    expect(modelLabel('gpt-5.4-mini')).toBe('GPT-5.4 Mini')
  })
  it('29: gemini', () => {
    expect(modelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro')
    expect(modelLabel('antigravity-gemini-3-pro-high')).toBe('Gemini 3 Pro High')
  })
})

describe('aggregateModels / aggregateProviders', () => {
  const now = new Date(2026, 5, 20)
  const bds: ModelBreakdownRaw[] = [
    { modelName: 'claude-opus-4-8', cost: 100, inputTokens: 10, outputTokens: 5, cacheReadTokens: 85 },
    { modelName: 'gpt-5.5', cost: 30, inputTokens: 20, outputTokens: 10 },
    { modelName: 'claude-sonnet-4-6', cost: 20, inputTokens: 5 },
    { modelName: 'gemini-2.5-pro', cost: 1, inputTokens: 1 },
  ]

  it('30: 모델별 합산 + 비용 내림차순', () => {
    const m = aggregateModels(bds)
    expect(m.map((x) => x.label)).toEqual(['Opus 4.8', 'GPT-5.5', 'Sonnet 4.6', 'Gemini 2.5 Pro'])
    expect(m[0].cost).toBe(100)
    expect(m[0].tokens).toBe(100) // 10+5+85
    expect(m[1].provider).toBe('Codex')
  })

  it('31: 동일 모델 여러 엔트리 합산', () => {
    const m = aggregateModels([
      { modelName: 'gpt-5.5', cost: 10, inputTokens: 1 },
      { modelName: 'gpt-5.5', cost: 5, inputTokens: 2 },
    ])
    expect(m).toHaveLength(1)
    expect(m[0].cost).toBe(15)
    expect(m[0].tokens).toBe(3)
  })

  it('32: 제공자별 그룹핑 (Claude/Codex/Gemini)', () => {
    const p = aggregateProviders(aggregateModels(bds))
    expect(p.map((x) => x.provider)).toEqual(['Claude', 'Codex', 'Gemini'])
    expect(p[0].cost).toBe(120) // opus 100 + sonnet 20
    expect(p[1].provider).toBe('Codex')
    expect(p[1].cost).toBe(30)
  })

  it('33: buildTokenStats — native monthly modelBreakdowns로 codex 추적', () => {
    const monthly: CcusageEntry[] = [{
      period: '2026-06', totalTokens: 1000, totalCost: 150, inputTokens: 0, outputTokens: 0,
      modelBreakdowns: bds,
    }]
    const s = buildTokenStats({ daily: [], monthly }, now)
    expect(s.modelBreakdown.map((x) => x.label)).toEqual(['Opus 4.8', 'GPT-5.5', 'Sonnet 4.6', 'Gemini 2.5 Pro'])
    expect(s.providerBreakdown.find((p) => p.provider === 'Codex')?.cost).toBe(30)
  })

  it('34: buildTokenStats — native 없으면 이번달 daily modelBreakdowns 폴백', () => {
    const daily: CcusageEntry[] = [{
      period: '2026-06-20', totalTokens: 40, totalCost: 31, inputTokens: 0, outputTokens: 0,
      modelBreakdowns: [{ modelName: 'gpt-5.5', cost: 31, inputTokens: 40 }],
    }]
    const s = buildTokenStats({ daily }, now)
    expect(s.modelBreakdown).toHaveLength(1)
    expect(s.modelBreakdown[0].provider).toBe('Codex')
    expect(s.modelBreakdown[0].cost).toBe(31)
  })
})
