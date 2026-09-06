import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import {
  TeamClaudeHealthSchema,
  TeamCodexPoolSchema,
  type RuntimeHealthStatus,
  type TeamClaudeHealth,
  type TeamCodexPool,
} from '../../lib/types'

const C = {
  bg: '#111418',
  card: '#1C2127',
  cardSub: '#252A31',
  border: '#404854',
  text: '#F6F7F9',
  textSub: '#ABB3BF',
  textWeak: '#738091',
  textDim: '#5F6B7C',
  ok: '#29A634',
  warning: '#D1980B',
  error: '#D33D17',
  blue: '#2D72D2',
}

const STATUS_LABEL: Record<RuntimeHealthStatus, string> = {
  ok: '정상',
  warning: '주의',
  error: '오류',
}

function statusColor(status: RuntimeHealthStatus): string {
  if (status === 'ok') return C.ok
  if (status === 'warning') return C.warning
  return C.error
}

function formatPercent(value: number | null): string {
  if (value == null) return '-'
  return `${value.toFixed(1)}%`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return '-'
  return time.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function codexStatusLabel(status: string, isCurrent: boolean): string {
  if (status === 'active') return isCurrent ? '사용 중' : '사용 가능'
  if (status === 'disabled') return '비활성'
  if (status === 'throttled') return '대기'
  if (status === 'exhausted') return '한도 도달'
  if (status === 'error') return '오류'
  return status === 'configured' ? '설정됨' : status
}

function codexStatusTone(status: string): string {
  if (status === 'active') return C.ok
  if (status === 'error' || status === 'exhausted') return C.error
  return status === 'disabled' ? C.textWeak : C.warning
}

function StatusPill({ status }: { status: RuntimeHealthStatus }) {
  const color = statusColor(status)
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function MetricCard({ label, value, tone = C.text }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}>
      <p className="text-2xl font-bold" style={{ color: tone }}>{value}</p>
      <p className="mt-1 text-[11px]" style={{ color: C.textWeak }}>{label}</p>
    </div>
  )
}

function BooleanRow({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: C.cardSub }}>
      <span className="text-xs" style={{ color: C.textSub }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: ok ? C.ok : C.warning }}>
        {ok ? okText : badText}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <h2 className="mb-4 text-sm font-semibold" style={{ color: C.text }}>{title}</h2>
      {children}
    </section>
  )
}

function TeamCodexPoolSection({ pool }: { pool: TeamCodexPool }) {
  const activeCount = pool.accounts.filter((account) => account.status === 'active').length
  const usableCount = pool.accounts.filter((account) => (
    account.enabled && !['disabled', 'error', 'exhausted', 'throttled'].includes(account.status)
  )).length

  return (
    <Section title="TeamCodex 계정 풀">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
            style={{
              color: pool.serverReachable ? C.ok : C.error,
              backgroundColor: `${pool.serverReachable ? C.ok : C.error}18`,
              border: `1px solid ${pool.serverReachable ? C.ok : C.error}40`,
            }}
          >
            {pool.serverReachable ? '온라인' : '오프라인'}
          </span>
          <span className="text-xs" style={{ color: C.textWeak }}>
            활성 {activeCount}/{pool.accounts.length} · 사용 가능 {usableCount} · port {pool.serverPort ?? '-'}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: C.textDim }}>
          전환 임계치 {formatPercent(pool.switchThresholdPercent)}
        </span>
      </div>

      {pool.accounts.length === 0 ? (
        <div className="rounded-lg px-4 py-5 text-sm" style={{ color: C.textWeak, backgroundColor: C.cardSub }}>
          TeamCodex 설정 계정을 찾지 못했습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.border}` }}>
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">TeamCodex 계정별 상태와 사용량</caption>
            <thead style={{ backgroundColor: C.cardSub }}>
              <tr className="text-[11px]" style={{ color: C.textWeak }}>
                <th className="px-3 py-2 font-semibold">계정</th>
                <th className="px-3 py-2 font-semibold">상태</th>
                <th className="px-3 py-2 font-semibold">5시간</th>
                <th className="px-3 py-2 font-semibold">7일</th>
                <th className="px-3 py-2 font-semibold">동시</th>
                <th className="px-3 py-2 font-semibold">요청</th>
                <th className="px-3 py-2 font-semibold">토큰</th>
              </tr>
            </thead>
            <tbody>
              {pool.accounts.map((account) => {
                const tone = codexStatusTone(account.status)
                return (
                  <tr
                    key={account.name}
                    className="border-t text-xs"
                    style={{
                      color: C.textSub,
                      borderColor: C.border,
                      backgroundColor: account.isCurrent ? `${C.ok}12` : 'transparent',
                    }}
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: account.isCurrent ? C.ok : C.text }}>
                      <span
                        className="mr-2 inline-block size-2 rounded-full"
                        style={{ backgroundColor: tone }}
                        aria-hidden="true"
                      />
                      {account.name}
                    </td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: tone }}>
                      {codexStatusLabel(account.status, account.isCurrent)}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{formatPercent(account.sessionPercent)}</td>
                    <td className="px-3 py-2.5 font-mono">{formatPercent(account.weeklyPercent)}</td>
                    <td className="px-3 py-2.5 font-mono">{account.inflight}/{account.maxConcurrent}</td>
                    <td className="px-3 py-2.5 font-mono">{formatInteger(account.totalRequests)}</td>
                    <td className="px-3 py-2.5 font-mono">{formatInteger(account.totalTokens)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

export default function RuntimeHealthView() {
  const [health, setHealth] = useState<TeamClaudeHealth | null>(null)
  const [teamCodex, setTeamCodex] = useState<TeamCodexPool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [healthRaw, teamCodexRaw] = await Promise.all([
        api.fetchTeamClaudeHealth(),
        api.fetchTeamCodexPool(),
      ])
      const parsedHealth = TeamClaudeHealthSchema.safeParse(healthRaw)
      const parsedTeamCodex = TeamCodexPoolSchema.safeParse(teamCodexRaw)
      if (!parsedHealth.success) {
        throw new Error('Claude 진단 데이터 형식이 올바르지 않습니다.')
      }
      if (!parsedTeamCodex.success) {
        throw new Error('Codex 계정 데이터 형식이 올바르지 않습니다.')
      }
      setHealth(parsedHealth.data)
      setTeamCodex(parsedTeamCodex.data)
    } catch (err) {
      setHealth(null)
      setTeamCodex(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const status = health?.overallStatus ?? 'warning'
  const teamclaude = health?.teamclaude
  const fable = teamclaude?.quota.fableWeekly
  const accountTone = teamclaude && teamclaude.accounts.active > 0 ? C.ok : C.warning
  const fableTone = fable?.allOverThreshold ? C.error : fable && fable.overThreshold > 0 ? C.warning : C.ok
  const checkedAt = useMemo(() => formatDate(health?.checkedAt ?? null), [health?.checkedAt])

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg }}>
      <div className="mx-auto max-w-[1400px] space-y-5 p-6">
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.text }}>AI 계정 진단</h1>
              <p className="text-xs" style={{ color: C.textWeak }}>마지막 확인 {checkedAt}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: C.textSub, backgroundColor: C.cardSub, border: `1px solid ${C.border}` }}
          >
            {loading ? '확인 중...' : '새로고침'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg p-4 text-sm" style={{ color: C.error, backgroundColor: `${C.error}12`, border: `1px solid ${C.error}35` }}>
            {error}
          </div>
        )}

        {teamCodex && <TeamCodexPoolSection pool={teamCodex} />}

        {teamclaude && fable && (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <MetricCard
                label="teamclaude 서버"
                value={teamclaude.server.reachable ? '연결됨' : '연결 실패'}
                tone={teamclaude.server.reachable ? C.ok : C.error}
              />
              <MetricCard
                label="active 계정"
                value={`${teamclaude.accounts.active}/${teamclaude.accounts.total || teamclaude.accounts.configured}`}
                tone={accountTone}
              />
              <MetricCard
                label="Fable 주간 임계치"
                value={`${fable.overThreshold}/${fable.knownAccounts}`}
                tone={fableTone}
              />
              <MetricCard
                label="동시 처리"
                value={`${teamclaude.accounts.inflight}/${teamclaude.accounts.capacity}`}
                tone={C.blue}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Section title="teamclaude proxy">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px]" style={{ color: C.textWeak }}>port</p>
                    <p className="font-mono" style={{ color: C.text }}>{teamclaude.server.port ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: C.textWeak }}>pid</p>
                    <p className="font-mono" style={{ color: C.text }}>{teamclaude.server.pid ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: C.textWeak }}>시작 시각</p>
                    <p style={{ color: C.textSub }}>{formatDate(teamclaude.server.startedAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: C.textWeak }}>switch threshold</p>
                    <p style={{ color: C.textSub }}>{formatPercent(teamclaude.config.switchThreshold * 100)}</p>
                  </div>
                </div>
              </Section>

              <Section title="계정 풀">
                <div className="grid grid-cols-3 gap-2">
                  <MetricCard label="active" value={String(teamclaude.accounts.active)} tone={C.ok} />
                  <MetricCard label="throttled" value={String(teamclaude.accounts.throttled)} tone={C.warning} />
                  <MetricCard label="error" value={String(teamclaude.accounts.error)} tone={teamclaude.accounts.error > 0 ? C.error : C.text} />
                </div>
              </Section>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Section title="Fable weekly quota">
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <MetricCard label="min" value={formatPercent(fable.minPercent)} />
                    <MetricCard label="avg" value={formatPercent(fable.avgPercent)} />
                    <MetricCard label="max" value={formatPercent(fable.maxPercent)} tone={fableTone} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: C.cardSub }}>
                    <span className="text-xs" style={{ color: C.textSub }}>다음 확인 가능 reset</span>
                    <span className="text-xs font-mono" style={{ color: C.textWeak }}>{formatDate(fable.soonestResetAt)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: C.cardSub }}>
                    <span className="text-xs" style={{ color: C.textSub }}>proxy Retry-After 추정</span>
                    <span className="text-xs font-mono" style={{ color: C.textWeak }}>
                      {teamclaude.retryAfterSeconds == null ? '-' : `${teamclaude.retryAfterSeconds}s`}
                    </span>
                  </div>
                </div>
              </Section>

              <Section title="Claude 라우팅">
                <div className="space-y-2">
                  <BooleanRow
                    label="현재 앱 프로세스 proxy env"
                    ok={!health.routing.currentProcessProxySet}
                    okText="깨끗함"
                    badText="남아 있음"
                  />
                  <BooleanRow
                    label="기본 claude wrapper"
                    ok={health.routing.defaultClaudeClearsProxy}
                    okText="proxy 해제"
                    badText="확인 필요"
                  />
                  <BooleanRow
                    label="teamclaude config"
                    ok={health.routing.teamclaudeConfigPresent}
                    okText="있음"
                    badText="없음"
                  />
                </div>
              </Section>
            </div>

            {health.hints.length > 0 && (
              <Section title="판단">
                <div className="space-y-2">
                  {health.hints.map((hint) => (
                    <div key={hint} className="rounded-lg px-3 py-2 text-xs" style={{ color: C.textSub, backgroundColor: C.cardSub }}>
                      {hint}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
