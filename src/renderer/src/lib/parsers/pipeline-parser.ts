import { PipelineEdgeSchema, type PipelineEdge } from '../types'

/**
 * agent-pipeline.md 마크다운에서 파이프라인 엣지를 추출한다.
 *
 * 파싱 대상 형식:
 * ```
 * ## {파이프라인 이름} 파이프라인
 * ```
 * code-reviewer
 *   → (조건부) security-reviewer   # 보안 민감 코드
 *   → (옵션) /codex-review          # 크로스모델 리뷰
 * ```
 *
 * 각 코드블록 내에서 → 로 연결된 에이전트 관계를 추출한다.
 */
export function parsePipeline(markdownContent: string): PipelineEdge[] {
  if (!markdownContent.trim()) return []

  const edges: PipelineEdge[] = []
  let currentPipeline = ''

  // ## 헤더에서 파이프라인 이름 추출
  const lines = markdownContent.split('\n')
  let inCodeBlock = false

  // 코드블록 안의 라인을 파이프라인별로 그룹핑
  let codeBlockLines: string[] = []

  for (const line of lines) {
    // 파이프라인 이름: "## 코드리뷰 파이프라인" 등
    const headerMatch = line.match(/^##\s+(.+?)(?:\s+파이프라인)?$/)
    if (headerMatch && !inCodeBlock) {
      currentPipeline = headerMatch[1].trim()
      // "파이프라인 규칙" 같은 비 파이프라인 헤더 제외
      if (currentPipeline.includes('규칙') || currentPipeline.includes('Rule')) {
        currentPipeline = ''
      }
      continue
    }

    // 코드블록 토글
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // 코드블록 종료 - 파싱
        if (currentPipeline) {
          const parsed = parseCodeBlockEdges(codeBlockLines, currentPipeline)
          edges.push(...parsed)
        }
        codeBlockLines = []
      }
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
    }
  }

  return deduplicateEdges(edges)
}

/**
 * 코드블록 내 라인들에서 에이전트 관계를 추출한다.
 *
 * 패턴:
 * - "agent-a" (루트 에이전트, 들여쓰기 없음)
 * - "  → agent-b" (무조건 연결)
 * - "  → (조건부) agent-c  # 설명" (조건부)
 * - "  → (옵션) agent-d" (옵션)
 * - "    → agent-e" (중첩: 이전 에이전트에서 연결)
 */
function parseCodeBlockEdges(
  lines: string[],
  pipelineName: string
): PipelineEdge[] {
  const edges: PipelineEdge[] = []
  // 들여쓰기 레벨별 마지막 에이전트 추적
  const stack: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('Phase')) continue

    // → 가 있는 라인: 화살표 연결
    const arrowMatch = trimmed.match(
      /^→\s+(?:\(([^)]+)\)\s+)?([a-zA-Z0-9_/-]+)/
    )
    if (arrowMatch) {
      const conditionRaw = arrowMatch[1] // "조건부", "옵션" 등
      const targetRaw = arrowMatch[2]
      // / 접두사 제거 (스킬 참조)
      const target = targetRaw.replace(/^\//, '')

      const condition = conditionRaw || undefined
      const indent = line.search(/\S/)
      const parentLevel = Math.max(0, Math.floor(indent / 2) - 1)

      const from = stack[parentLevel] ?? stack[stack.length - 1]
      if (from && target) {
        const edge = PipelineEdgeSchema.safeParse({
          from,
          to: target,
          condition,
          pipelineName
        })
        if (edge.success) {
          edges.push(edge.data)
        }
      }

      // 현재 레벨에 타겟 기록
      const currentLevel = Math.floor(indent / 2)
      stack[currentLevel] = target
      // 더 깊은 레벨 정리
      stack.length = currentLevel + 1
      continue
    }

    // 루트 에이전트 (→ 없는 라인)
    const rootMatch = trimmed.match(/^([a-zA-Z0-9_/-]+)/)
    if (rootMatch) {
      const agent = rootMatch[1].replace(/^\//, '')
      stack.length = 0
      stack[0] = agent
    }
  }

  return edges
}

function deduplicateEdges(edges: PipelineEdge[]): PipelineEdge[] {
  const seen = new Set<string>()
  return edges.filter((e) => {
    const key = `${e.from}→${e.to}:${e.pipelineName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
