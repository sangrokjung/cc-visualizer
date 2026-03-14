import { SessionLogSchema, type SessionLog } from '../types'

/**
 * 단일 session-summary JSON을 파싱한다.
 * @param jsonContent - JSON 문자열 또는 파싱된 객체
 * @param filename - 파일명 (e.g. "session-summary-abc123.json")
 * @param timestamp - 파일 수정 시간 (ISO string, 선택)
 */
export function parseSessionLog(
  jsonContent: string | Record<string, unknown>,
  filename: string,
  timestamp?: string
): SessionLog | null {
  try {
    const data =
      typeof jsonContent === 'string'
        ? (JSON.parse(jsonContent) as Record<string, unknown>)
        : jsonContent

    // 파일명에서 세션 ID 추출: session-summary-{uuid}.json
    const idMatch = filename.match(/session-summary-(.+)\.json$/)
    const sessionId = idMatch ? idMatch[1] : filename

    const raw = {
      sessionId,
      status: data.status,
      summary: typeof data.summary === 'string' ? data.summary : '',
      changes: Array.isArray(data.changes) ? data.changes : [],
      testResults: data.test_results ?? data.testResults ?? null,
      nextSteps: data.next_steps ?? data.nextSteps ?? [],
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      timestamp: timestamp ?? new Date().toISOString()
    }

    const parsed = SessionLogSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * 여러 세션 로그를 한꺼번에 파싱한다.
 * @param files - { filename, content, timestamp? } 배열
 * @returns SessionLog[] (파싱 실패 항목 제외, 최신순 정렬)
 */
export function parseSessionLogs(
  files: Array<{ filename: string; content: string; timestamp?: string }>
): SessionLog[] {
  return files
    .map((f) => parseSessionLog(f.content, f.filename, f.timestamp))
    .filter((log): log is SessionLog => log !== null)
    .sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0
      return b.timestamp.localeCompare(a.timestamp)
    })
}
