import { useMemo } from 'react'
import { useSessionEventsContext } from '../SessionEventsProvider'

// 토큰/비용 추정 — Anthropic 정확한 토크나이저 대신 char/4 추정 (보편 휴리스틱)
// 비용은 Sonnet 4 기준 (input $3/M, output $15/M)
// agor(1210★) 영감: per-prompt token + dollar accounting

const SONNET_INPUT_PER_M = 3.0
const SONNET_OUTPUT_PER_M = 15.0
const CHARS_PER_TOKEN = 4

export type TokenSample = {
  ts: number // epoch ms
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system'
  tokens: number
  isInput: boolean // input(user/system/tool_result) vs output(assistant)
}

export type TokenFlowSummary = {
  samples: TokenSample[] // 시계열 (오래된→최신)
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  recentSamples: TokenSample[] // 최근 20개 (sparkline용)
  maxTokens: number
}

const EMPTY: TokenFlowSummary = {
  samples: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUsd: 0,
  recentSamples: [],
  maxTokens: 0
}

export function useTokenFlow(): TokenFlowSummary {
  const { events } = useSessionEventsContext()

  return useMemo<TokenFlowSummary>(() => {
    if (events.length === 0) return EMPTY

    // events는 최신→오래된 순. 시간순(오래된→최신)으로 변환.
    const chronological = [...events].reverse()

    const samples: TokenSample[] = []
    let totalInput = 0
    let totalOutput = 0

    for (const ev of chronological) {
      const ts = Date.parse(ev.timestamp)
      if (Number.isNaN(ts)) continue
      // charCount(백엔드 정확 집계) 우선, 없으면 text 길이 폴백
      const charCount =
        ev.data.charCount ??
        (ev.data.text ?? ev.data.toolInput ?? ev.data.command ?? '').length
      const tokens = Math.ceil(charCount / CHARS_PER_TOKEN)
      if (tokens === 0) continue

      let type: TokenSample['type']
      let isInput = true
      switch (ev.type) {
        case 'user':
          type = 'user'
          break
        case 'assistant':
          type = 'assistant'
          isInput = false
          break
        case 'tool_use':
          type = 'tool_use'
          isInput = false // tool_use는 assistant 출력의 일부
          break
        case 'system':
          type = 'system'
          break
        default:
          continue
      }

      samples.push({ ts, type, tokens, isInput })
      if (isInput) totalInput += tokens
      else totalOutput += tokens
    }

    const totalCostUsd =
      (totalInput / 1_000_000) * SONNET_INPUT_PER_M +
      (totalOutput / 1_000_000) * SONNET_OUTPUT_PER_M

    const recentSamples = samples.slice(-20)
    const maxTokens = recentSamples.reduce((m, s) => (s.tokens > m ? s.tokens : m), 0)

    return {
      samples,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCostUsd,
      recentSamples,
      maxTokens
    }
  }, [events])
}
