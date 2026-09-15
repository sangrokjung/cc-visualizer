import { describe, it, expect } from 'vitest'
import {
  USD_KRW_FALLBACK,
  usdToKrw,
  formatKrw,
  formatKrwShort,
  parseErApiKrw,
} from '../../src/renderer/src/lib/fx'

describe('fx — USD→KRW 변환', () => {
  it('1: usdToKrw — 곱셈', () => {
    expect(usdToKrw(10, 1380)).toBe(13800)
  })

  it('2: usdToKrw — NaN/Infinity 방어 → 0', () => {
    expect(usdToKrw(NaN, 1380)).toBe(0)
    expect(usdToKrw(10, Infinity)).toBe(0)
  })

  it('3: formatKrw — 반올림 + ko-KR 천단위', () => {
    expect(formatKrw(10, 1380.4)).toBe('₩13,804')
    expect(formatKrw(0.041, 1380)).toBe('₩57') // 56.58 → 57
  })

  it('4: USD_KRW_FALLBACK 합리적 범위', () => {
    expect(USD_KRW_FALLBACK).toBeGreaterThan(1000)
    expect(USD_KRW_FALLBACK).toBeLessThan(2000)
  })

  it('5: formatKrwShort — 만 단위', () => {
    expect(formatKrwShort(100, 1380)).toBe('₩14만') // 138,000 → 13.8만 → 14만
  })

  it('6: formatKrwShort — 천만 단위', () => {
    // $26,692 * 1380 ≈ 36,835,000 → 3.7천만
    expect(formatKrwShort(26692, 1380)).toBe('₩3.7천만')
  })

  it('7: formatKrwShort — 억 단위', () => {
    // $100,000 * 1380 = 138,000,000 → 1.4억
    expect(formatKrwShort(100000, 1380)).toBe('₩1.4억')
  })

  it('8: formatKrwShort — 만 미만', () => {
    expect(formatKrwShort(1, 1380)).toBe('₩1,380')
  })

  it('9: parseErApiKrw — 정상 응답', () => {
    expect(parseErApiKrw({ result: 'success', rates: { KRW: 1382.5, USD: 1 } })).toBe(1382.5)
  })

  it('10: parseErApiKrw — result 실패 → null', () => {
    expect(parseErApiKrw({ result: 'error', rates: { KRW: 1382 } })).toBeNull()
  })

  it('11: parseErApiKrw — rates 없음/형식 불량 → null', () => {
    expect(parseErApiKrw({})).toBeNull()
    expect(parseErApiKrw({ rates: { KRW: 'x' } })).toBeNull()
    expect(parseErApiKrw(null)).toBeNull()
    expect(parseErApiKrw({ rates: { KRW: -5 } })).toBeNull()
  })

  it('12: parseErApiKrw — result 키 없어도 rates 있으면 통과', () => {
    expect(parseErApiKrw({ rates: { KRW: 1400 } })).toBe(1400)
  })
})
