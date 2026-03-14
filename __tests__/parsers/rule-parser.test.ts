import { describe, it, expect } from 'vitest'
import { parseRule, parseRules } from '@/lib/parsers/rule-parser'

const CRITICAL_CONTENT = `# Golden Principles (CRITICAL)

> 핵심 원칙 12가지

| # | 원칙 |
|---|------|
| 1 | 불변성 |
`

const IMPORTANT_CONTENT = `# Agent Orchestration (IMPORTANT)

## Built-in Skills

| Skill | When to Use |
|-------|-------------|
| /simplify | 코드 정리 |
`

const NORMAL_CONTENT = `# Email Rules

이메일 처리 규칙을 정의한다.
`

const DIR_PATH = '~/qjc-office/dotclaude/rules'

describe('parseRule', () => {
  it('CRITICAL 파일을 정확히 파싱한다', () => {
    const result = parseRule(CRITICAL_CONTENT, 'golden-principles.md', DIR_PATH)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('golden-principles')
    expect(result!.priority).toBe('critical')
    expect(result!.path).toBe(`${DIR_PATH}/golden-principles.md`)
  })

  it('IMPORTANT 파일을 정확히 파싱한다', () => {
    const result = parseRule(IMPORTANT_CONTENT, 'agents-v2.md', DIR_PATH)
    expect(result).not.toBeNull()
    expect(result!.priority).toBe('important')
  })

  it('마커 없는 파일은 normal', () => {
    const result = parseRule(NORMAL_CONTENT, 'email.md', DIR_PATH)
    expect(result).not.toBeNull()
    expect(result!.priority).toBe('normal')
  })

  it('.md가 아닌 파일은 null', () => {
    expect(parseRule('content', 'readme.txt', DIR_PATH)).toBeNull()
  })

  it('빈 내용이라도 파일명이 .md면 파싱한다', () => {
    const result = parseRule('', 'empty.md', DIR_PATH)
    expect(result).not.toBeNull()
    expect(result!.priority).toBe('normal')
  })
})

describe('parseRules', () => {
  it('여러 룰 파일을 한꺼번에 파싱한다', () => {
    const files = [
      { filename: 'golden-principles.md', content: CRITICAL_CONTENT },
      { filename: 'agents-v2.md', content: IMPORTANT_CONTENT },
      { filename: 'email.md', content: NORMAL_CONTENT }
    ]
    const result = parseRules(files, DIR_PATH)
    expect(result).toHaveLength(3)

    const critical = result.find((r) => r.priority === 'critical')
    expect(critical).toBeDefined()
    expect(critical!.name).toBe('golden-principles')
  })

  it('.md가 아닌 파일은 제외한다', () => {
    const files = [
      { filename: 'golden-principles.md', content: CRITICAL_CONTENT },
      { filename: 'readme.txt', content: 'not a rule' }
    ]
    const result = parseRules(files, DIR_PATH)
    expect(result).toHaveLength(1)
  })

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(parseRules([], DIR_PATH)).toEqual([])
  })
})
