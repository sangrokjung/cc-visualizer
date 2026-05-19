import { describe, it, expect } from 'vitest'
import { formatScanTimestamp } from '../../src/renderer/src/lib/format-scan-timestamp'

describe('formatScanTimestamp', () => {
  it('1: undefined 입력 → "스캔 정보 없음"', () => {
    const result = formatScanTimestamp(undefined)
    expect(result).toBe('스캔 정보 없음')
  })

  it('2: invalid timestamp "not-a-date" → "스캔 정보 없음"', () => {
    const now = new Date('2026-05-14T10:00:00.000Z')
    const result = formatScanTimestamp('not-a-date', now)
    expect(result).toBe('스캔 정보 없음')
  })

  it('3: 25초 전 → "방금 전"', () => {
    const now = new Date('2026-05-14T10:00:00.000Z')
    const timestamp = new Date(now.getTime() - 25 * 1000).toISOString()
    const result = formatScanTimestamp(timestamp, now)
    expect(result).toBe('방금 전')
  })

  it('4: 5분 전 (5 * 60_000ms) → "5분 전"', () => {
    const now = new Date('2026-05-14T10:00:00.000Z')
    const timestamp = new Date(now.getTime() - 5 * 60_000).toISOString()
    const result = formatScanTimestamp(timestamp, now)
    expect(result).toBe('5분 전')
  })

  it('5: 3시간 전 (3 * 3600_000ms) → "3시간 전"', () => {
    const now = new Date('2026-05-14T10:00:00.000Z')
    const timestamp = new Date(now.getTime() - 3 * 3_600_000).toISOString()
    const result = formatScanTimestamp(timestamp, now)
    expect(result).toBe('3시간 전')
  })

  it('6: 어제 14:30 (now=2026-05-14T10:00 기준) → "어제 14:30"', () => {
    // now: 2026-05-14 10:00 UTC
    // timestamp: 2026-05-13 14:30 UTC → 어제
    const now = new Date('2026-05-14T10:00:00.000Z')
    const timestamp = new Date('2026-05-13T14:30:00.000Z').toISOString()
    const result = formatScanTimestamp(timestamp, now)
    expect(result).toBe('어제 14:30')
  })

  it('7: 7일 전 → "YYYY-MM-DD HH:MM" 형식', () => {
    const now = new Date('2026-05-14T10:00:00.000Z')
    const timestamp = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString()
    const result = formatScanTimestamp(timestamp, now)
    // 정규식으로 형식만 검증
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})
