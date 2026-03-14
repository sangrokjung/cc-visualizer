import { describe, it, expect } from 'vitest'
import { parseSessionLog, parseSessionLogs } from '@/lib/parsers/session-parser'

const SAMPLE_SESSION = JSON.stringify({
  status: 'success',
  summary: '이메일 확인 후 회신 발송 완료.',
  changes: ['file1.md', 'file2.ts'],
  test_results: null,
  next_steps: ['미팅 참석', '서류 확인'],
  blockers: []
})

const PARTIAL_SESSION = JSON.stringify({
  status: 'partial',
  summary: '작업 중단됨',
  changes: [],
  test_results: 'tests: 5 passed, 1 failed',
  next_steps: [],
  blockers: ['API 키 만료']
})

const FILENAME = 'session-summary-abc123-def456.json'

describe('parseSessionLog', () => {
  it('정상 세션 로그를 파싱한다', () => {
    const result = parseSessionLog(SAMPLE_SESSION, FILENAME, '2026-03-14T10:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('abc123-def456')
    expect(result!.status).toBe('success')
    expect(result!.summary).toBe('이메일 확인 후 회신 발송 완료.')
    expect(result!.changes).toEqual(['file1.md', 'file2.ts'])
    expect(result!.testResults).toBeNull()
    expect(result!.nextSteps).toEqual(['미팅 참석', '서류 확인'])
    expect(result!.blockers).toEqual([])
  })

  it('partial 상태를 파싱한다', () => {
    const result = parseSessionLog(PARTIAL_SESSION, 'session-summary-xyz.json')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('partial')
    expect(result!.blockers).toEqual(['API 키 만료'])
    expect(result!.testResults).toBe('tests: 5 passed, 1 failed')
  })

  it('JSON 객체도 받을 수 있다', () => {
    const obj = { status: 'failure', summary: '실패', changes: [], blockers: [] }
    const result = parseSessionLog(obj as Record<string, unknown>, FILENAME)
    expect(result).not.toBeNull()
    expect(result!.status).toBe('failure')
  })

  it('snake_case와 camelCase 모두 지원한다', () => {
    const camelCase = JSON.stringify({
      status: 'success',
      summary: 'test',
      changes: [],
      testResults: 'all passed',
      nextSteps: ['step1'],
      blockers: []
    })
    const result = parseSessionLog(camelCase, FILENAME)
    expect(result).not.toBeNull()
    expect(result!.testResults).toBe('all passed')
    expect(result!.nextSteps).toEqual(['step1'])
  })

  it('잘못된 JSON은 null', () => {
    expect(parseSessionLog('not json{', 'bad.json')).toBeNull()
  })

  it('빈 문자열은 null', () => {
    expect(parseSessionLog('', 'empty.json')).toBeNull()
  })

  it('status가 잘못된 값이면 null', () => {
    const badStatus = JSON.stringify({ status: 'unknown', summary: 'test' })
    expect(parseSessionLog(badStatus, 'bad-status.json')).toBeNull()
  })

  it('파일명에서 세션 ID를 추출한다', () => {
    const result = parseSessionLog(
      SAMPLE_SESSION,
      'session-summary-e1b321b1-0ed3-449b-901d-8c76a289e84d.json'
    )
    expect(result!.sessionId).toBe('e1b321b1-0ed3-449b-901d-8c76a289e84d')
  })
})

describe('parseSessionLogs', () => {
  it('여러 세션 로그를 파싱하고 최신순 정렬한다', () => {
    const files = [
      { filename: 'session-summary-old.json', content: SAMPLE_SESSION, timestamp: '2026-03-13T10:00:00Z' },
      { filename: 'session-summary-new.json', content: PARTIAL_SESSION, timestamp: '2026-03-14T10:00:00Z' }
    ]
    const result = parseSessionLogs(files)
    expect(result).toHaveLength(2)
    expect(result[0].sessionId).toBe('new') // 최신이 먼저
    expect(result[1].sessionId).toBe('old')
  })

  it('파싱 실패 항목은 제외한다', () => {
    const files = [
      { filename: 'session-summary-ok.json', content: SAMPLE_SESSION },
      { filename: 'session-summary-bad.json', content: 'invalid json' }
    ]
    const result = parseSessionLogs(files)
    expect(result).toHaveLength(1)
  })

  it('빈 배열은 빈 배열', () => {
    expect(parseSessionLogs([])).toEqual([])
  })
})
