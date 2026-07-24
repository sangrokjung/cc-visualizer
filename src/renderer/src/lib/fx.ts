// 환율(USD → KRW) 변환 + 포맷 순수 로직. React/Tauri 의존 없음 — vitest 대상.

// 라이브 환율 조회 실패 시 사용하는 폴백 상수 (2026 중반 USD/KRW 근사).
// 라이브 환율(open.er-api.com)이 우선이며, 이 값은 네트워크 실패 시에만 쓰인다.
export const USD_KRW_FALLBACK = 1450

export interface FxRate {
  rate: number // KRW per 1 USD
  source: 'live' | 'cache' | 'fallback'
  fetchedAt: number // epoch ms
}

export function usdToKrw(usd: number, rate: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(rate)) return 0
  return usd * rate
}

// ₩1,234,567 — 정수 원화 (소수점 없음, 한국 표기)
export function formatKrw(usd: number, rate: number): string {
  const krw = Math.round(usdToKrw(usd, rate))
  return `₩${krw.toLocaleString('ko-KR')}`
}

// 큰 금액 축약: ₩3.5천만 / ₩1.2억 / ₩45만 / ₩1,234
export function formatKrwShort(usd: number, rate: number): string {
  const krw = Math.round(usdToKrw(usd, rate))
  const abs = Math.abs(krw)
  const sign = krw < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(abs >= 1_000_000_000 ? 0 : 1)}억`
  if (abs >= 10_000_000) return `${sign}₩${(abs / 10_000_000).toFixed(1)}천만`
  if (abs >= 10_000) return `${sign}₩${Math.round(abs / 10_000).toLocaleString('ko-KR')}만`
  return `${sign}₩${abs.toLocaleString('ko-KR')}`
}

// open.er-api.com 응답에서 KRW 환율 추출. 형식이 다르면 null.
export function parseErApiKrw(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null
  const o = json as { result?: string; rates?: Record<string, unknown> }
  if (o.result && o.result !== 'success') return null
  const krw = o.rates?.KRW
  if (typeof krw === 'number' && Number.isFinite(krw) && krw > 0) return krw
  return null
}
