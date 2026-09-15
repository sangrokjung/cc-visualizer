import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { USD_KRW_FALLBACK, type FxRate } from '../fx'

// USD→KRW 환율 훅. 백엔드(Tauri curl)가 라이브 환율을 주고, 실패 시 폴백 상수.
// localStorage 12h 캐시 — FX는 천천히 변하므로 자주 호출하지 않는다.

const CACHE_KEY = 'cc-viz-usdkrw'
const TTL_MS = 12 * 60 * 60 * 1000 // 12시간

function readCache(): FxRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as FxRate
    if (typeof c.rate !== 'number' || !Number.isFinite(c.rate) || c.rate <= 0) return null
    return c
  } catch {
    return null
  }
}

function writeCache(r: FxRate): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(r))
  } catch {
    /* localStorage 불가(시크릿 모드 등) — 무시 */
  }
}

export function useUsdKrwRate(): FxRate & { refresh: () => void } {
  const cached = readCache()
  const [fx, setFx] = useState<FxRate>(
    cached ?? { rate: USD_KRW_FALLBACK, source: 'fallback', fetchedAt: 0 },
  )

  const load = useCallback(async (force = false) => {
    // 캐시가 신선하면(12h 이내) 네트워크 생략
    const c = readCache()
    if (!force && c && Date.now() - c.fetchedAt < TTL_MS) {
      setFx({ ...c, source: 'cache' })
      return
    }
    try {
      const r = await api.fetchUsdKrwRate()
      if (r && Number.isFinite(r.rate) && r.rate > 0) {
        const next: FxRate = {
          rate: r.rate,
          source: (r.source === 'live' ? 'live' : 'fallback'),
          fetchedAt: r.fetchedAt || Date.now(),
        }
        setFx(next)
        if (next.source === 'live') writeCache(next)
        return
      }
      throw new Error('invalid rate')
    } catch {
      // 네트워크/Tauri 실패 → 캐시 → 폴백
      if (c) setFx({ ...c, source: 'cache' })
      else setFx({ rate: USD_KRW_FALLBACK, source: 'fallback', fetchedAt: 0 })
    }
  }, [])

  useEffect(() => {
    load()
    // 12시간마다 갱신 시도
    const id = setInterval(() => load(true), TTL_MS)
    return () => clearInterval(id)
  }, [load])

  return { ...fx, refresh: () => load(true) }
}
