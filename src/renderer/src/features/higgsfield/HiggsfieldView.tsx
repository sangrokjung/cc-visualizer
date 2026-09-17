// 힉스필드(Higgsfield AI) 크레딧 뷰.
// 잔액만 보여주면 정작 중요한 사실을 놓친다 — 갱신 때 미사용분은 이월되지 않고 사라진다.
// 그래서 이 화면의 중심은 "언제 리셋되고(D-day), 그때 얼마가 사라질 것인가"다.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../lib/api'
import {
  HiggsfieldAccountSchema,
  HiggsfieldTransactionsSchema,
  type HiggsfieldAccount,
  type HiggsfieldTransaction,
  type HiggsfieldTransactions,
} from '../../lib/types'
import {
  estimateCycle,
  formatCredits,
  formatDday,
  projectExpiry,
  netUsageSince,
  subscriptionGrants,
  subscriptionResets,
  totalSpend,
  usageByDay,
  usageByModel,
} from './higgsfieldCredits'

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
  violet: '#7961DB',
  teal: '#00A396',
}

const MODEL_PALETTE = ['#2D72D2', '#7961DB', '#00A396', '#29A634', '#D1980B', '#DB2C6F', '#147EB3']

/// 자동 새로고침 5분. 크레딧은 생성할 때만 움직여서 더 촘촘히 볼 이유가 없다.
const AUTO_REFRESH_MS = 5 * 60 * 1000

function formatKstDateTime(ms: number | null): string {
  if (ms == null || Number.isNaN(ms)) return '-'
  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatKstDate(ms: number | null): string {
  if (ms == null || Number.isNaN(ms)) return '-'
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: ReactNode
  color: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <p className="text-[11px]" style={{ color: C.textWeak }}>
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
      {sub ? (
        <p className="text-[11px] mt-1" style={{ color: C.textDim }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: C.text }}>
          {title}
        </h2>
        {note ? (
          <span className="text-[11px]" style={{ color: C.textDim }}>
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.cardSub }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

function actionStyle(action: string): { label: string; color: string } {
  if (action === 'grant') return { label: '지급', color: C.ok }
  if (action === 'deduct') return { label: '소멸', color: C.error }
  // 생성이 실패하면 크레딧이 되돌아온다. 사용과 같은 칸에 두면 읽는 사람이 오해한다.
  if (action === 'refund') return { label: '환불', color: C.teal }
  return { label: '사용', color: C.textSub }
}

export default function HiggsfieldView() {
  const [account, setAccount] = useState<HiggsfieldAccount | null>(null)
  const [transactions, setTransactions] = useState<HiggsfieldTransactions | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // 남은 일수를 시계와 함께 움직이게 한다(자정을 넘기면 D-day가 바뀐다).
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    setSchemaError(null)
    const [accRaw, txRaw] = await Promise.all([
      api.fetchHiggsfieldAccount(),
      api.fetchHiggsfieldTransactions(3),
    ])

    // CLI 응답은 외부 입력이다. 형식이 바뀌면 화면을 반쯤 그리는 대신 그 사실을 말한다.
    const acc = HiggsfieldAccountSchema.safeParse(accRaw)
    const tx = HiggsfieldTransactionsSchema.safeParse(txRaw)
    if (acc.success && tx.success) {
      setAccount(acc.data)
      setTransactions(tx.data)
    } else {
      setAccount(null)
      setTransactions(null)
      setSchemaError('힉스필드 응답 형식이 예상과 다릅니다. CLI 버전을 확인하세요.')
    }

    setNow(Date.now())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => void load(), AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const items: HiggsfieldTransaction[] = useMemo(() => transactions?.items ?? [], [transactions])

  const cycle = useMemo(() => estimateCycle(items, now), [items, now])
  const grants = useMemo(() => subscriptionGrants(items), [items])
  const resets = useMemo(() => subscriptionResets(items), [items])
  const cycleSpend = useMemo(() => netUsageSince(items, cycle.lastGrantAt), [items, cycle.lastGrantAt])
  const spentThisCycle = useMemo(() => totalSpend(cycleSpend), [cycleSpend])
  const byModel = useMemo(() => usageByModel(cycleSpend), [cycleSpend])
  const byDay = useMemo(
    () => usageByDay(cycleSpend, cycle.lastGrantAt, now),
    [cycleSpend, cycle.lastGrantAt, now]
  )

  const balance = account?.account?.credits ?? 0
  const grantAmount = grants[0]?.credits ?? null

  const projection = useMemo(
    () =>
      projectExpiry({
        balance,
        spent: spentThisCycle,
        elapsedDays: cycle.elapsedDays,
        cycleDays: cycle.cycleDays,
        grantAmount,
      }),
    [balance, spentThisCycle, cycle.elapsedDays, cycle.cycleDays, grantAmount]
  )

  const lastReset = resets[0] ?? null
  const accountError = account && !account.ok ? account.error : null
  const txError = transactions && !transactions.ok ? transactions.error : null
  const failure = schemaError ?? accountError ?? txError

  const ddayColor =
    cycle.daysRemaining == null
      ? C.textWeak
      : cycle.daysRemaining <= 3
        ? C.error
        : cycle.daysRemaining <= 7
          ? C.warning
          : C.blue

  if (loading && !account) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: C.bg, color: C.textWeak }}>
        힉스필드 크레딧 불러오는 중...
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4" style={{ backgroundColor: C.bg }}>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: C.text }}>
            힉스필드 크레딧
          </h1>
          <p className="text-[11px] mt-1" style={{ color: C.textDim }}>
            {account?.account?.email ?? '계정 미확인'}
            {account?.account?.subscription_plan_type
              ? ` · ${account.account.subscription_plan_type.toUpperCase()} 플랜`
              : ''}
            {account?.checkedAt ? ` · ${formatKstDateTime(new Date(account.checkedAt).getTime())} 기준` : ''}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: C.cardSub, color: C.textSub, border: `1px solid ${C.border}` }}
        >
          {loading ? '불러오는 중' : '새로고침'}
        </button>
      </header>

      {failure ? (
        <div className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.error}` }}>
          <p className="text-sm font-semibold" style={{ color: C.error }}>
            힉스필드 정보를 불러오지 못했습니다
          </p>
          <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: C.textSub }}>
            {failure}
          </p>
          <p className="text-xs mt-2" style={{ color: C.textDim }}>
            터미널에서 <code style={{ color: C.text }}>higgsfield auth login</code> 으로 로그인한 뒤 새로고침하세요.
            CLI가 없으면 <code style={{ color: C.text }}>npm i -g @higgsfield/cli</code> 로 설치합니다.
          </p>
        </div>
      ) : null}

      {transactions?.partialError ? (
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: C.card, border: `1px solid ${C.warning}`, color: C.textSub }}>
          거래내역 일부만 받았습니다: {transactions.partialError}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="잔여 크레딧"
          value={formatCredits(balance)}
          sub={grantAmount ? `주기 지급 ${formatCredits(grantAmount)}` : undefined}
          color={C.text}
        />
        <StatCard
          label="다음 리셋까지"
          value={formatDday(cycle.daysRemaining)}
          sub={formatKstDate(cycle.nextRenewalAt)}
          color={ddayColor}
        />
        <StatCard
          label="이번 주기 사용"
          value={formatCredits(spentThisCycle)}
          sub={`하루 평균 ${formatCredits(projection.perDay)}`}
          color={C.teal}
        />
        <StatCard
          label="소멸 예상"
          value={formatCredits(projection.projectedExpiry)}
          sub={
            projection.projectedExpiryRatio != null
              ? `지급분의 ${Math.round(projection.projectedExpiryRatio * 100)}%`
              : '현재 페이스 기준'
          }
          color={projection.projectedExpiry > 0 ? C.warning : C.ok}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Section
          title="재구독 (구독 갱신)"
          note={
            cycle.assumedCycle
              ? `주기 미실측 · 기본 ${cycle.cycleDays}일 가정`
              : `${cycle.cycleDays}일 주기 · 갱신 ${grants.length}건 실측`
          }
        >
          {cycle.lastGrantAt == null ? (
            <p className="text-xs" style={{ color: C.textWeak }}>
              거래내역에 구독 지급 기록이 없어 갱신일을 계산할 수 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px]" style={{ color: C.textWeak }}>
                    다음 재구독 예정
                  </p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: C.text }}>
                    {formatKstDateTime(cycle.nextRenewalAt)}
                  </p>
                </div>
                <p className="text-2xl font-bold" style={{ color: ddayColor }}>
                  {formatDday(cycle.daysRemaining)}
                </p>
              </div>

              <div>
                <ProgressBar ratio={cycle.elapsedRatio ?? 0} color={C.blue} />
                <div className="flex justify-between mt-1 text-[11px]" style={{ color: C.textDim }}>
                  <span>시작 {formatKstDate(cycle.lastGrantAt)}</span>
                  <span>
                    {cycle.elapsedDays != null ? `${Math.floor(cycle.elapsedDays)}일 경과` : ''} / {cycle.cycleDays}일
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: C.textDim }}>
                힉스필드는 갱신일을 API로 주지 않습니다. 위 날짜는 구독 지급(grant) 이력의 간격으로 계산한 추정입니다.
                {grants.length >= 2
                  ? ` 최근 지급 ${formatKstDate(grants[0].at)}, 그 전 ${formatKstDate(grants[1].at)}.`
                  : ' 지급 기록이 1건뿐이라 기본 주기를 가정했습니다.'}
              </p>
            </div>
          )}
        </Section>

        <Section title="미사용분 소멸" note="갱신 시 잔여 크레딧은 이월되지 않습니다">
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px]" style={{ color: C.textWeak }}>
                  이 페이스면 리셋 때 사라질 양
                </p>
                <p className="text-xl font-bold mt-0.5" style={{ color: projection.projectedExpiry > 0 ? C.warning : C.ok }}>
                  {formatCredits(projection.projectedExpiry)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px]" style={{ color: C.textWeak }}>
                  남은 기간 예상 사용
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: C.textSub }}>
                  {formatCredits(projection.projectedSpend)}
                </p>
              </div>
            </div>

            {grantAmount ? (
              <ProgressBar
                ratio={projection.projectedExpiryRatio ?? 0}
                color={projection.projectedExpiry > 0 ? C.warning : C.ok}
              />
            ) : null}

            {lastReset ? (
              <p className="text-[11px] leading-relaxed" style={{ color: C.textDim }}>
                직전 갱신({formatKstDate(lastReset.at)})에는 {formatCredits(Math.abs(lastReset.credits))} 크레딧이 실제로 소멸했습니다.
                {grants.length >= 2 && grants[1].credits > 0
                  ? ` 그 주기 지급분 ${formatCredits(grants[1].credits)} 중 ${Math.round((Math.abs(lastReset.credits) / grants[1].credits) * 100)}%입니다.`
                  : ''}
              </p>
            ) : (
              <p className="text-[11px]" style={{ color: C.textDim }}>
                아직 소멸 기록이 없습니다.
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section title="일별 사용 추이" note="현재 주기">
        {byDay.length === 0 ? (
          <p className="text-xs" style={{ color: C.textWeak }}>
            이번 주기에 사용한 크레딧이 없습니다.
          </p>
        ) : (
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.cardSub} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} interval="preserveStartEnd" />
                <YAxis tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} />
                <Tooltip
                  contentStyle={{ backgroundColor: C.cardSub, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: C.textSub }}
                  formatter={(value: number) => [`${formatCredits(value)} 크레딧`, '사용']}
                />
                <Bar dataKey="credits" radius={[3, 3, 0, 0]}>
                  {byDay.map((row) => (
                    <Cell key={row.date} fill={row.credits > 0 ? C.blue : C.cardSub} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-4">
        <Section title="모델별 사용" note="현재 주기">
          {byModel.length === 0 ? (
            <p className="text-xs" style={{ color: C.textWeak }}>
              사용 기록이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {byModel.slice(0, 7).map((row, index) => {
                const ratio = spentThisCycle > 0 ? row.credits / spentThisCycle : 0
                return (
                  <li key={row.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: C.textSub }}>
                        {row.name}
                        <span style={{ color: C.textDim }}> · {row.count}회</span>
                      </span>
                      <span style={{ color: C.text }}>{formatCredits(row.credits)}</span>
                    </div>
                    <ProgressBar ratio={ratio} color={MODEL_PALETTE[index % MODEL_PALETTE.length]} />
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title="최근 거래" note={`${items.length}건 조회`}>
          {items.length === 0 ? (
            <p className="text-xs" style={{ color: C.textWeak }}>
              거래내역이 없습니다.
            </p>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              <table className="w-full text-xs">
                <tbody>
                  {items.slice(0, 40).map((item, index) => {
                    const style = actionStyle(item.action)
                    return (
                      <tr key={`${item.created_at}-${index}`} style={{ borderBottom: `1px solid ${C.cardSub}` }}>
                        <td className="py-1.5 pr-2 whitespace-nowrap" style={{ color: C.textDim }}>
                          {formatKstDateTime(new Date(item.created_at).getTime())}
                        </td>
                        <td className="py-1.5 pr-2" style={{ color: C.textSub }}>
                          {item.display_name ?? '-'}
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap" style={{ color: style.color }}>
                          {style.label}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap font-medium" style={{ color: style.color }}>
                          {item.credits > 0 ? '+' : ''}
                          {formatCredits(item.credits)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
