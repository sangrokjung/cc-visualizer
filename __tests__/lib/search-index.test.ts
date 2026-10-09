import { describe, it, expect } from 'vitest'
import { buildIndex, search } from '../../src/renderer/src/lib/search-index'
import type { AgentNode, HookEvent, PipelineEdge, RuleFile } from '../../src/renderer/src/lib/types'

const AGENTS: AgentNode[] = [
  {
    id: 'planner',
    name: 'Planner',
    description: 'Plans features',
    tools: [],
    model: 'opus',
    color: '#fff',
    category: 'development',
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    description: 'Reviews diffs',
    tools: [],
    model: 'sonnet',
    color: '#fff',
    category: 'review',
  },
]

const PIPELINES: PipelineEdge[] = [
  { from: 'planner', to: 'reviewer', pipelineName: 'feature' },
  { from: 'reviewer', to: 'planner', pipelineName: 'loop' },
]

const HOOKS: HookEvent[] = [
  { event: 'PreToolUse', matcher: 'Bash', hooks: [] },
  { event: 'PreToolUse', matcher: 'Edit', hooks: [] },
  { event: 'PostToolUse', matcher: 'Bash', hooks: [] },
]

const RULES: RuleFile[] = [
  { name: 'security', path: '/rules/security.md', priority: 'critical' },
]

describe('buildIndex', () => {
  const index = buildIndex(AGENTS, PIPELINES, HOOKS, RULES)

  it('에이전트 항목에 카테고리·모델·연결 파이프라인 수를 싣는다', () => {
    const planner = index.find((r) => r.id === 'agent-planner')
    expect(planner).toMatchObject({
      label: 'Planner',
      type: 'agent',
      targetView: 'agent-map',
      description: 'Plans features [development, opus, 2 pipelines]',
    })
  })

  it('파이프라인이 없는 에이전트는 파이프라인 수를 생략한다', () => {
    const solo = buildIndex([AGENTS[0]], [], [], [])
    expect(solo[0].description).toBe('Plans features [development, opus]')
  })

  it('훅 이벤트와 매처는 각각 한 번씩만 넣는다', () => {
    const hookIds = index.filter((r) => r.type === 'hook').map((r) => r.id)
    expect(hookIds).toEqual([
      'hook-event-PreToolUse',
      'hook-matcher-Bash',
      'hook-matcher-Edit',
      'hook-event-PostToolUse',
    ])
    expect(index.filter((r) => r.type === 'hook').every((r) => r.targetView === 'architecture')).toBe(true)
  })

  it('룰 항목은 우선순위를 설명에 싣는다', () => {
    expect(index.find((r) => r.id === 'rule-security')).toMatchObject({
      type: 'rule',
      targetView: 'architecture',
      description: 'Rule file [critical]',
    })
  })
})

describe('search', () => {
  const index = buildIndex(AGENTS, PIPELINES, HOOKS, RULES)

  it('빈 질의·공백 질의는 결과 없음', () => {
    expect(search(index, '')).toEqual([])
    expect(search(index, '   ')).toEqual([])
  })

  it('라벨을 대소문자 구분 없이 찾는다', () => {
    expect(search(index, 'REVIEWER').map((r) => r.id)).toEqual(['agent-reviewer'])
  })

  it('설명(모델명 등)으로도 찾는다', () => {
    expect(search(index, 'sonnet').map((r) => r.id)).toEqual(['agent-reviewer'])
  })

  it('limit만큼 자른다', () => {
    expect(search(index, 'hook', 2)).toHaveLength(2)
  })
})
