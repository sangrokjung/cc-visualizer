import { RuleFileSchema, type RuleFile, type RulePriority } from '../types'

/**
 * 파일 내용에서 우선도 마커를 추출한다.
 * (CRITICAL) > (IMPORTANT) > 기본 normal
 */
function extractPriority(content: string): RulePriority {
  // 제목이나 첫 줄 근처에서 마커를 찾는다
  const upperContent = content.toUpperCase()
  if (upperContent.includes('(CRITICAL)')) return 'critical'
  if (upperContent.includes('(IMPORTANT)')) return 'important'
  return 'normal'
}

/**
 * 파일명에서 표시 이름을 추출한다.
 * e.g. "golden-principles.md" -> "golden-principles"
 */
function extractName(filename: string): string {
  return filename.replace(/\.md$/, '')
}

/**
 * 단일 룰 파일을 파싱한다.
 * @param content - 파일 전체 내용
 * @param filename - 파일명 (e.g. "golden-principles.md")
 * @param dirPath - 디렉토리 경로 (e.g. "~/qjc-office/dotclaude/rules")
 */
export function parseRule(
  content: string,
  filename: string,
  dirPath: string
): RuleFile | null {
  if (!filename.endsWith('.md')) return null

  const priority = extractPriority(content)
  const name = extractName(filename)
  const path = `${dirPath}/${filename}`

  const parsed = RuleFileSchema.safeParse({ name, path, priority })
  return parsed.success ? parsed.data : null
}

/**
 * 여러 룰 파일을 한꺼번에 파싱한다.
 * @param files - { filename, content } 배열
 * @param dirPath - 룰 파일 디렉토리 경로
 */
export function parseRules(
  files: Array<{ filename: string; content: string }>,
  dirPath: string
): RuleFile[] {
  return files
    .map((f) => parseRule(f.content, f.filename, dirPath))
    .filter((rule): rule is RuleFile => rule !== null)
}
