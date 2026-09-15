import { describe, it, expect } from 'vitest'
import { shortenHomePath } from '../../src/renderer/src/lib/format-path'

describe('shortenHomePath', () => {
  it('1: sangrok 개발 PC 경로 → ~/ 단축', () => {
    expect(shortenHomePath('/Users/sangrok/qjc-office/dotclaude/rules/x.md')).toBe(
      '~/qjc-office/dotclaude/rules/x.md'
    )
  })

  it('2: 다른 직원 username(kim) → ~/ 단축 (PC 무관)', () => {
    expect(shortenHomePath('/Users/kim/.claude/rules/x.md')).toBe('~/.claude/rules/x.md')
  })

  it('3: 또 다른 username(jang.so-young) → ~/ 단축 (점·하이픈 포함)', () => {
    expect(shortenHomePath('/Users/jang.so-young/.claude/agents/a.md')).toBe(
      '~/.claude/agents/a.md'
    )
  })

  it('4: Linux /home/<user> 경로도 단축 (보너스)', () => {
    expect(shortenHomePath('/home/alice/.claude/settings.json')).toBe(
      '~/.claude/settings.json'
    )
  })

  it('5: 이미 ~ 로 시작하는 경로는 그대로 통과', () => {
    expect(shortenHomePath('~/.claude/rules/x.md')).toBe('~/.claude/rules/x.md')
  })

  it('6: home 외부 절대경로는 변경하지 않음', () => {
    expect(shortenHomePath('/opt/homebrew/bin/npx')).toBe('/opt/homebrew/bin/npx')
  })

  it('7: /Users 루트 자체(하위 세그먼트 없음)는 단축하지 않음', () => {
    expect(shortenHomePath('/Users/sangrok')).toBe('/Users/sangrok')
  })

  it('8: 빈 문자열 입력은 그대로 반환 (방어)', () => {
    expect(shortenHomePath('')).toBe('')
  })

  it('9: home prefix는 첫 1회만 치환 (경로 중간 /Users/...는 보존)', () => {
    expect(shortenHomePath('/Users/kim/projects/Users-backup/x')).toBe(
      '~/projects/Users-backup/x'
    )
  })
})
