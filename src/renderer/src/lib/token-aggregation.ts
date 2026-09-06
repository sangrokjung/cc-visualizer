// ccusage daily/weekly/monthly 응답을 정규화하는 순수 로직.
// React/Tauri 의존 없음 — vitest 단위 테스트 대상.
//
// 정확성 원칙: 주간/월간/누적은 ccusage native weekly/monthly 명령 결과를 그대로 쓴다
// (= `ccusage weekly`/`ccusage monthly` CLI 출력과 정확히 일치). native가 없으면 daily에서 파생.

// ccusage 엔트리의 모델별 분해 (claude-opus-4-8, gpt-5.5, gemini-2.5-pro 등)
export interface ModelBreakdownRaw {
  modelName: string
  cost: number
  inputTokens?: number
  outputTokens?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
}

// ccusage daily/weekly/monthly 엔트리는 동일한 형태를 공유한다.
// period: daily=YYYY-MM-DD, weekly=YYYY-MM-DD(주 시작=월요일), monthly=YYYY-MM
export interface CcusageEntry {
  period: string
  totalTokens: number
  totalCost: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  modelsUsed?: string[]
  modelBreakdowns?: ModelBreakdownRaw[]
  metadata?: { agents?: string[] }
}

// 모델 제공자 — codex(gpt/openai) 추적이 핵심. ccusage가 집계하는 멀티 에이전트 구분.
export type Provider = 'Claude' | 'Codex' | 'Gemini' | 'MiniMax' | 'GLM' | 'Other'

export interface ModelUsage {
  model: string // raw 모델명 'claude-opus-4-8'
  label: string // 표시명 'Opus 4.8'
  provider: Provider
  cost: number
  tokens: number
}

export interface ProviderUsage {
  provider: Provider
  cost: number
  tokens: number
}

export interface CcusageTotals {
  totalTokens: number
  totalCost: number
}

export interface TokenBucket {
  tokens: number
  cost: number
}

export interface PeriodTotal {
  tokens: number
  cost: number
  days: number // 집계에 포함된 활동 일수 (native 주/월은 근사: daily 파생 일수)
}

export interface DailyPoint {
  period: string // 'YYYY-MM-DD'
  tokens: number
  cost: number
  inputTokens: number
  outputTokens: number
}

export interface TokenStats {
  today: TokenBucket | null
  yesterday: TokenBucket | null
  thisWeek: PeriodTotal // 이번 주 (월요일 시작) — native weekly 우선
  thisMonth: PeriodTotal // 이번 달 (YYYY-MM) — native monthly 우선
  weekly: PeriodTotal // 최근 7일 롤링 (하위호환 — daily 파생)
  allTime: PeriodTotal // 전체 누적 — monthly totals 우선
  todayVsYesterday: number | null
  recentDaily: DailyPoint[]
  modelBreakdown: ModelUsage[] // 이번 달 모델별 (비용 내림차순) — codex 포함
  providerBreakdown: ProviderUsage[] // 이번 달 제공자별 (Claude/Codex/Gemini…)
}

// 로컬 타임존 기준 'YYYY-MM-DD'
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 로컬 타임존 기준 'YYYY-MM'
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// d가 속한 주의 월요일(00:00) 날짜 키. ccusage weekly가 월요일 시작이라 이에 맞춘다.
export function mondayKey(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = x.getDay() // 0=일 .. 6=토
  const diff = dow === 0 ? 6 : dow - 1 // 월요일까지 거슬러 올라갈 일수
  x.setDate(x.getDate() - diff)
  return dateKey(x)
}

// Claude 엔트리 필터 — agents/modelsUsed 메타가 없으면 graceful 통과(전체 포함).
// daily(today/yesterday/추이)에만 적용. native weekly/monthly는 CLI 패리티 위해 raw 사용.
export function isClaudeEntry(e: CcusageEntry): boolean {
  const agents = e.metadata?.agents ?? []
  if (agents.some((a) => a.toLowerCase().includes('claude'))) return true
  const models = e.modelsUsed ?? []
  if (models.length === 0 && agents.length === 0) return true
  return models.some((m) => m.toLowerCase().includes('claude'))
}

// 모델명 → 제공자. codex(gpt/openai) 추적이 핵심. 접두사 기반 분류.
export function providerOf(model: string): Provider {
  const m = model.toLowerCase()
  if (m.startsWith('claude')) return 'Claude'
  if (m.startsWith('gpt') || m.includes('codex') || m.startsWith('o1') || m.startsWith('o3')) return 'Codex'
  if (m.includes('gemini')) return 'Gemini'
  if (m.includes('minimax')) return 'MiniMax'
  if (m.startsWith('glm')) return 'GLM'
  return 'Other'
}

// 제공자별 브랜드 색 (UI 일관성 — 메뉴바와 동일 팔레트)
export const PROVIDER_COLOR: Record<Provider, string> = {
  Claude: '#D1980B', // 앰버(앤트로픽 톤)
  Codex: '#00A396', // 청록(OpenAI 톤)
  Gemini: '#7961DB', // 보라
  MiniMax: '#DB2C6F',
  GLM: '#D33D17',
  Other: '#738091',
}

// 8자리 날짜 접미사 제거 (claude-haiku-4-5-20251001 → claude-haiku-4-5)
function stripDate(model: string): string {
  return model.replace(/-\d{8}$/, '')
}

const LABEL_WORD: Record<string, string> = {
  codex: 'Codex', max: 'Max', mini: 'Mini', pro: 'Pro', flash: 'Flash',
  high: 'High', preview: 'Preview', image: 'Image', free: 'Free',
}
const titleWord = (w: string) => LABEL_WORD[w.toLowerCase()] ?? w

// raw 모델명 → 사람이 읽기 좋은 표시명.
export function modelLabel(model: string): string {
  const base = stripDate(model)
  const lo = base.toLowerCase()
  const claude = base.match(/^claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d+))?$/i)
  if (claude) {
    const tier = claude[1][0].toUpperCase() + claude[1].slice(1).toLowerCase()
    return claude[3] ? `${tier} ${claude[2]}.${claude[3]}` : `${tier} ${claude[2]}`
  }
  if (lo.startsWith('gpt')) {
    const parts = base.split('-') // ['gpt','5.1','codex','max']
    const ver = parts[1] ?? ''
    return ['GPT-' + ver, ...parts.slice(2).map(titleWord)].join(' ').trim()
  }
  if (lo.includes('gemini')) {
    const rest = base.replace(/^antigravity-/i, '').replace(/^gemini-?/i, '')
    return ('Gemini ' + rest.split(/[-/]/).map(titleWord).join(' ')).trim()
  }
  return base // minimax/glm/기타는 raw 유지 (provider 그룹핑은 providerOf가 처리)
}

// 모델 분해 배열들을 모델명 기준으로 합산 → ModelUsage[] (비용 내림차순).
export function aggregateModels(breakdowns: ModelBreakdownRaw[]): ModelUsage[] {
  const acc: Record<string, { cost: number; tokens: number }> = {}
  for (const b of breakdowns) {
    if (!b || !b.modelName) continue
    const tok =
      (b.inputTokens ?? 0) + (b.outputTokens ?? 0) + (b.cacheCreationTokens ?? 0) + (b.cacheReadTokens ?? 0)
    if (!acc[b.modelName]) acc[b.modelName] = { cost: 0, tokens: 0 }
    acc[b.modelName].cost += b.cost ?? 0
    acc[b.modelName].tokens += tok
  }
  return Object.entries(acc)
    .map(([model, v]) => ({
      model,
      label: modelLabel(model),
      provider: providerOf(model),
      cost: v.cost,
      tokens: v.tokens,
    }))
    .sort((a, b) => b.cost - a.cost)
}

// ModelUsage[] → 제공자별 합산 (비용 내림차순). Codex/Claude/Gemini 추적.
export function aggregateProviders(models: ModelUsage[]): ProviderUsage[] {
  const acc: Record<string, { cost: number; tokens: number }> = {}
  for (const m of models) {
    if (!acc[m.provider]) acc[m.provider] = { cost: 0, tokens: 0 }
    acc[m.provider].cost += m.cost
    acc[m.provider].tokens += m.tokens
  }
  return Object.entries(acc)
    .map(([provider, v]) => ({ provider: provider as Provider, cost: v.cost, tokens: v.tokens }))
    .sort((a, b) => b.cost - a.cost)
}

function sumBucket(entries: CcusageEntry[]): { tokens: number; cost: number; days: number } {
  let tokens = 0
  let cost = 0
  for (const e of entries) {
    tokens += e.totalTokens
    cost += e.totalCost
  }
  return { tokens, cost, days: entries.length }
}

// native 배열에서 현재 기간 엔트리를 고른다. period === key 우선, 없으면 마지막 엔트리(시간순 가정).
function pickCurrent(entries: CcusageEntry[], key: string): CcusageEntry | null {
  if (entries.length === 0) return null
  const exact = entries.find((e) => e.period === key)
  if (exact) return exact
  // 키와 정확히 일치하는 게 없으면(예: 이번 주/달 활동 없음) 가장 최근을 쓰지 않는다 —
  // 그건 과거 데이터라 0이어야 맞다. null 반환 → 호출부가 0 처리.
  return null
}

/**
 * daily + (옵션) native weekly/monthly 응답으로 TokenStats를 조립한다.
 * native가 있으면 thisWeek/thisMonth/allTime를 CLI 패리티로 채우고, 없으면 daily에서 파생한다.
 */
export function buildTokenStats(
  input: {
    daily: CcusageEntry[]
    weekly?: CcusageEntry[]
    monthly?: CcusageEntry[]
    monthlyTotals?: CcusageTotals | null
  },
  now: Date,
): TokenStats {
  // daily는 필터하지 않는다 — ccusage CLI 패리티(all agents) + 메뉴바(Swift)와 동일 수치 보장.
  // isClaudeEntry는 향후 'Claude만 보기' 토글용으로 export 유지(현재 buildTokenStats 미적용).
  // (이전엔 daily만 isClaudeEntry로 필터해 native weekly/monthly·Swift와 미세하게 어긋났음.)
  const daily = input.daily ?? []
  const weekly = input.weekly ?? []
  const monthly = input.monthly ?? []

  const todayK = dateKey(now)
  const yK = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const weekStartK = mondayKey(now)
  const monthK = monthKey(now)

  let today: TokenBucket | null = null
  let yesterday: TokenBucket | null = null
  let rollingT = 0
  let rollingC = 0
  let rollingDays = 0
  let dailyAllT = 0
  let dailyAllC = 0

  // 최근 7일 롤링 키 집합
  const rolling7 = new Set<string>()
  for (let i = 0; i < 7; i++) {
    rolling7.add(dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)))
  }

  for (const e of daily) {
    dailyAllT += e.totalTokens
    dailyAllC += e.totalCost
    if (e.period === todayK) today = { tokens: e.totalTokens, cost: e.totalCost }
    if (e.period === yK) yesterday = { tokens: e.totalTokens, cost: e.totalCost }
    if (rolling7.has(e.period)) {
      rollingT += e.totalTokens
      rollingC += e.totalCost
      rollingDays++
    }
  }

  // daily 파생 폴백 — 이번 주(월요일 시작 이후) / 이번 달(YYYY-MM)
  const weekDaily = daily.filter((e) => e.period >= weekStartK && e.period <= todayK)
  const monthDaily = daily.filter((e) => e.period.startsWith(monthK))
  const derivedWeek = sumBucket(weekDaily)
  const derivedMonth = sumBucket(monthDaily)

  // thisWeek — native weekly 현재 주 우선, 없으면 daily 파생
  const nativeWeek = pickCurrent(weekly, weekStartK)
  const thisWeek: PeriodTotal = nativeWeek
    ? { tokens: nativeWeek.totalTokens, cost: nativeWeek.totalCost, days: derivedWeek.days }
    : { tokens: derivedWeek.tokens, cost: derivedWeek.cost, days: derivedWeek.days }

  // thisMonth — native monthly 현재 달 우선, 없으면 daily 파생
  const nativeMonth = pickCurrent(monthly, monthK)
  const thisMonth: PeriodTotal = nativeMonth
    ? { tokens: nativeMonth.totalTokens, cost: nativeMonth.totalCost, days: derivedMonth.days }
    : { tokens: derivedMonth.tokens, cost: derivedMonth.cost, days: derivedMonth.days }

  // allTime — monthly totals 우선(정확), 없으면 daily 합산
  const allTime: PeriodTotal = input.monthlyTotals
    ? { tokens: input.monthlyTotals.totalTokens, cost: input.monthlyTotals.totalCost, days: daily.length }
    : { tokens: dailyAllT, cost: dailyAllC, days: daily.length }

  // 이번 달 모델별 — native monthly 엔트리의 modelBreakdowns 우선(이미 월 집계),
  // 없으면 이번 달 daily 엔트리들의 modelBreakdowns 합산. codex(gpt) 포함.
  const monthBreakdowns: ModelBreakdownRaw[] =
    nativeMonth?.modelBreakdowns ?? monthDaily.flatMap((e) => e.modelBreakdowns ?? [])
  const modelBreakdown = aggregateModels(monthBreakdowns)
  const providerBreakdown = aggregateProviders(modelBreakdown)

  const todayVsYesterday =
    today && yesterday && yesterday.cost > 0
      ? ((today.cost - yesterday.cost) / yesterday.cost) * 100
      : null

  const recentDaily: DailyPoint[] = [...daily]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-14)
    .map((e) => ({
      period: e.period,
      tokens: e.totalTokens,
      cost: e.totalCost,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
    }))

  return {
    today,
    yesterday,
    thisWeek,
    thisMonth,
    weekly: { tokens: rollingT, cost: rollingC, days: rollingDays },
    allTime,
    todayVsYesterday,
    recentDaily,
    modelBreakdown,
    providerBreakdown,
  }
}
