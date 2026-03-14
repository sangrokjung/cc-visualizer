import { HookEventSchema, type HookEvent, type HookEntry } from '../types'

interface RawHookEntry {
  type?: string
  command?: string
  timeout?: number
  async?: boolean
}

interface RawHookGroup {
  matcher?: string
  hooks?: RawHookEntry[]
}

type RawHooksSection = Record<string, RawHookGroup[] | undefined>

/**
 * settings.json의 hooks 섹션을 파싱하여 HookEvent[] 반환.
 * @param settingsJson - settings.json 전체 또는 hooks 섹션 객체
 */
export function parseHooks(
  settingsJson: Record<string, unknown>
): HookEvent[] {
  const hooksSection = (settingsJson.hooks ?? settingsJson) as RawHooksSection
  if (typeof hooksSection !== 'object' || hooksSection === null) return []

  const result: HookEvent[] = []

  for (const [eventName, groups] of Object.entries(hooksSection)) {
    if (!Array.isArray(groups)) continue

    for (const group of groups) {
      const matcher = typeof group.matcher === 'string' ? group.matcher : 'ALL'

      const hooks: HookEntry[] = []
      if (Array.isArray(group.hooks)) {
        for (const h of group.hooks) {
          if (typeof h.command !== 'string') continue
          hooks.push({
            type: 'command',
            command: h.command,
            timeout: typeof h.timeout === 'number' ? h.timeout : 5000,
            async: h.async === true
          })
        }
      }

      if (hooks.length === 0) continue

      const parsed = HookEventSchema.safeParse({
        event: eventName,
        matcher,
        hooks
      })

      if (parsed.success) {
        result.push(parsed.data)
      }
    }
  }

  return result
}

/**
 * HookEvent[] 에서 고유 이벤트 타입 목록 추출
 */
export function getUniqueEventTypes(hooks: HookEvent[]): string[] {
  return [...new Set(hooks.map((h) => h.event))]
}

/**
 * 전체 훅 개수 (HookEntry 단위) 카운트
 */
export function countTotalHooks(hooks: HookEvent[]): number {
  return hooks.reduce((sum, h) => sum + h.hooks.length, 0)
}
