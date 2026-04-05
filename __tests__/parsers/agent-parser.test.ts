import { describe, it, expect } from 'vitest'
import { parseAgent, parseAgents } from '@/lib/parsers/agent-parser'

const ARCHITECT_MD = `---
name: architect
description: |
  Use when making architectural decisions, diagnosing complex bugs, or evaluating system design trade-offs.
tools: ["Read", "Grep", "Glob", "Bash"]
model: opus
memory: project
maxTurns: 20
color: blue
---

# Architect content here
`

const COPYWRITING_MD = `---
name: copywriting
description: |
  Use when writing or editing marketing copy: landing pages, ad copy, email sequences.
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
model: opus
memory: user
maxTurns: 25
color: magenta
---

# Copywriting agent
`

const MINIMAL_MD = `---
name: simple-agent
description: A simple agent
tools: []
model: sonnet
color: green
---
`

describe('parseAgent', () => {
  it('architect.md를 정확히 파싱한다', () => {
    const result = parseAgent(ARCHITECT_MD, 'architect.md')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('architect')
    expect(result!.name).toBe('architect')
    expect(result!.model).toBe('opus')
    expect(result!.tools).toEqual(['Read', 'Grep', 'Glob', 'Bash'])
    expect(result!.maxTurns).toBe(20)
    expect(result!.memory).toBe('project')
    expect(result!.color).toBe('blue')
    expect(result!.category).toBe('development')
  })

  it('copywriting 에이전트의 카테고리를 marketing으로 분류한다', () => {
    const result = parseAgent(COPYWRITING_MD, 'copywriting.md')
    expect(result).not.toBeNull()
    expect(result!.category).toBe('marketing')
    expect(result!.memory).toBe('user')
  })

  it('최소 frontmatter도 파싱한다', () => {
    const result = parseAgent(MINIMAL_MD, 'simple-agent.md')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('simple-agent')
    expect(result!.tools).toEqual([])
    expect(result!.maxTurns).toBeUndefined()
  })

  it('빈 문자열은 null을 반환한다', () => {
    expect(parseAgent('', 'empty.md')).toBeNull()
  })

  it('frontmatter가 없는 파일은 null을 반환한다', () => {
    expect(parseAgent('# Just a markdown file\nNo frontmatter here', 'no-fm.md')).toBeNull()
  })

  it('name이 없는 frontmatter는 null을 반환한다', () => {
    const noName = `---
description: No name field
tools: []
---
`
    expect(parseAgent(noName, 'no-name.md')).toBeNull()
  })

  it('잘못된 frontmatter는 null을 반환한다', () => {
    const bad = `---
name: [invalid yaml array as name
---
`
    expect(parseAgent(bad, 'bad.md')).toBeNull()
  })
})

describe('parseAgents', () => {
  it('여러 파일을 한꺼번에 파싱한다', () => {
    const files = [
      { filename: 'architect.md', content: ARCHITECT_MD },
      { filename: 'copywriting.md', content: COPYWRITING_MD }
    ]
    const result = parseAgents(files)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('architect')
    expect(result[1].id).toBe('copywriting')
  })

  it('파싱 실패한 항목은 제외한다', () => {
    const files = [
      { filename: 'architect.md', content: ARCHITECT_MD },
      { filename: 'empty.md', content: '' },
      { filename: 'bad.md', content: 'not yaml frontmatter' }
    ]
    const result = parseAgents(files)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('architect')
  })

  it('빈 배열을 받으면 빈 배열을 반환한다', () => {
    expect(parseAgents([])).toEqual([])
  })
})
