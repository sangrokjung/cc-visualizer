import { describe, it, expect } from 'vitest'
import { parsePipeline } from '@/lib/parsers/pipeline-parser'

const SAMPLE_PIPELINE_MD = `# Agent Pipeline

## 코드리뷰 파이프라인

\`\`\`
code-reviewer
  → (조건부) security-reviewer   # 보안 민감 코드
  → (조건부) database-reviewer   # DB 스키마/쿼리 변경 시
  → (옵션) /codex-review          # 크로스모델 리뷰
  → (옵션) /gemini-review         # 프론트엔드 크로스모델 리뷰
\`\`\`

## 설계/구현 파이프라인

\`\`\`
planner
  → architect
  → tdd-guide
  → code-reviewer
\`\`\`

## 비즈니스 파이프라인

\`\`\`
qjc-business
  → quotation
  → qjc-operations
  → qjc-content
  → performance-growth-marketer
    → ad-optimizer-team
\`\`\`

## 파이프라인 규칙

1. 순서 강제
2. 조건부 분기
`

describe('parsePipeline', () => {
  it('코드리뷰 파이프라인을 파싱한다', () => {
    const edges = parsePipeline(SAMPLE_PIPELINE_MD)
    const reviewEdges = edges.filter((e) => e.pipelineName === '코드리뷰')

    expect(reviewEdges.length).toBeGreaterThanOrEqual(4)

    const securityEdge = reviewEdges.find((e) => e.to === 'security-reviewer')
    expect(securityEdge).toBeDefined()
    expect(securityEdge!.from).toBe('code-reviewer')
    expect(securityEdge!.condition).toBe('조건부')
  })

  it('설계/구현 파이프라인을 파싱한다', () => {
    const edges = parsePipeline(SAMPLE_PIPELINE_MD)
    const designEdges = edges.filter((e) => e.pipelineName.includes('설계'))

    expect(designEdges.length).toBeGreaterThanOrEqual(3)

    const plannerToArchitect = designEdges.find(
      (e) => e.from === 'planner' && e.to === 'architect'
    )
    expect(plannerToArchitect).toBeDefined()
    expect(plannerToArchitect!.condition).toBeUndefined()
  })

  it('중첩된 에이전트 관계를 파싱한다', () => {
    const edges = parsePipeline(SAMPLE_PIPELINE_MD)

    const adOptimizer = edges.find((e) => e.to === 'ad-optimizer-team')
    expect(adOptimizer).toBeDefined()
    expect(adOptimizer!.from).toBe('performance-growth-marketer')
  })

  it('/ 접두사 스킬 참조에서 슬래시를 제거한다', () => {
    const edges = parsePipeline(SAMPLE_PIPELINE_MD)
    const codexEdge = edges.find((e) => e.to === 'codex-review')
    expect(codexEdge).toBeDefined()
    expect(codexEdge!.to).toBe('codex-review')
  })

  it('"파이프라인 규칙" 헤더는 무시한다', () => {
    const edges = parsePipeline(SAMPLE_PIPELINE_MD)
    const ruleEdges = edges.filter((e) => e.pipelineName === '파이프라인 규칙')
    expect(ruleEdges).toHaveLength(0)
  })

  it('빈 문자열은 빈 배열', () => {
    expect(parsePipeline('')).toEqual([])
  })

  it('코드블록이 없는 마크다운은 빈 배열', () => {
    const noCodeBlock = `# Pipeline\n\n## Test\n\nNo code block here.`
    expect(parsePipeline(noCodeBlock)).toEqual([])
  })

  it('중복 엣지를 제거한다', () => {
    const duplicated = `## 테스트

\`\`\`
a
  → b
  → b
\`\`\`
`
    const edges = parsePipeline(duplicated)
    const abEdges = edges.filter((e) => e.from === 'a' && e.to === 'b')
    expect(abEdges).toHaveLength(1)
  })
})
