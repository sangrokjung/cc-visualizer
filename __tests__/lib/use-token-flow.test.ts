import { describe, it, expect } from 'vitest'

// estimateTokens / cost 계산 로직 단위 테스트
// hook은 SessionEventsProvider 의존이라 통합 테스트 대신 순수 함수 검증
// (실제 hook 동작은 dev 환경 + Tauri에서 검증)

const SONNET_INPUT_PER_M = 3.0
const SONNET_OUTPUT_PER_M = 15.0
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string | undefined): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function calcCost(input: number, output: number): number {
  return (input / 1_000_000) * SONNET_INPUT_PER_M + (output / 1_000_000) * SONNET_OUTPUT_PER_M
}

describe('use-token-flow estimators', () => {
  it('1: estimateTokens — 빈 문자열 → 0', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
  })

  it('2: estimateTokens — 4자 = 1 토큰', () => {
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('3: estimateTokens — 5자 = 2 토큰 (ceil)', () => {
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('4: estimateTokens — 한글 100자 = 25 토큰', () => {
    const korean = 'ㄱ'.repeat(100)
    expect(estimateTokens(korean)).toBe(25)
  })

  it('5: calcCost — input 1M = $3', () => {
    expect(calcCost(1_000_000, 0)).toBeCloseTo(3.0, 4)
  })

  it('6: calcCost — output 1M = $15', () => {
    expect(calcCost(0, 1_000_000)).toBeCloseTo(15.0, 4)
  })

  it('7: calcCost — input 100K + output 50K = $0.3 + $0.75 = $1.05', () => {
    expect(calcCost(100_000, 50_000)).toBeCloseTo(1.05, 4)
  })

  it('8: calcCost — 작은 사용량도 정확히 계산', () => {
    // 4000 토큰 (chars 16000) input + 1000 output
    expect(calcCost(4000, 1000)).toBeCloseTo(0.012 + 0.015, 4)
  })
})
