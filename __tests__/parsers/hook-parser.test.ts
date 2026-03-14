import { describe, it, expect } from 'vitest'
import { parseHooks, getUniqueEventTypes, countTotalHooks } from '@/lib/parsers/hook-parser'

const SAMPLE_SETTINGS = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: '~/.claude/hooks/guard.sh', timeout: 5000 },
          { type: 'command', command: '~/.claude/hooks/check.sh', timeout: 3000 }
        ]
      },
      {
        matcher: 'mcp__*',
        hooks: [
          { type: 'command', command: '~/.claude/hooks/rate-limiter.sh', timeout: 5000 },
          { type: 'command', command: '~/.claude/hooks/tracker.sh', timeout: 3000, async: true }
        ]
      }
    ],
    SessionStart: [
      {
        hooks: [
          { type: 'command', command: '~/.claude/hooks/start.sh', timeout: 5000 },
          { type: 'command', command: '~/.claude/hooks/notify.sh', timeout: 5000, async: true }
        ]
      }
    ],
    Stop: [
      {
        hooks: [
          { type: 'command', command: '~/.claude/hooks/stop.sh', timeout: 5000 }
        ]
      }
    ]
  }
}

describe('parseHooks', () => {
  it('settings.json에서 훅 이벤트를 정확히 파싱한다', () => {
    const result = parseHooks(SAMPLE_SETTINGS)
    expect(result.length).toBe(4) // PreToolUse(2) + SessionStart(1) + Stop(1)
  })

  it('matcher가 없는 그룹은 ALL로 처리한다', () => {
    const result = parseHooks(SAMPLE_SETTINGS)
    const sessionStart = result.find((h) => h.event === 'SessionStart')
    expect(sessionStart).toBeDefined()
    expect(sessionStart!.matcher).toBe('ALL')
  })

  it('async 플래그를 정확히 파싱한다', () => {
    const result = parseHooks(SAMPLE_SETTINGS)
    const mcpGroup = result.find((h) => h.matcher === 'mcp__*')
    expect(mcpGroup).toBeDefined()
    const asyncHook = mcpGroup!.hooks.find((h) => h.async)
    expect(asyncHook).toBeDefined()
    expect(asyncHook!.command).toContain('tracker.sh')
  })

  it('빈 객체는 빈 배열을 반환한다', () => {
    expect(parseHooks({})).toEqual([])
  })

  it('hooks 섹션이 없는 settings는 빈 배열을 반환한다', () => {
    expect(parseHooks({ permissions: {} })).toEqual([])
  })

  it('command가 없는 훅 항목은 건너뛴다', () => {
    const bad = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              { type: 'command' }, // command 누락
              { type: 'command', command: '~/.claude/hooks/ok.sh' }
            ]
          }
        ]
      }
    }
    const result = parseHooks(bad)
    expect(result).toHaveLength(1)
    expect(result[0].hooks).toHaveLength(1)
  })

  it('hooks 배열이 비어있는 그룹은 제외한다', () => {
    const noHooks = {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [] }]
      }
    }
    expect(parseHooks(noHooks)).toEqual([])
  })
})

describe('getUniqueEventTypes', () => {
  it('고유 이벤트 타입을 반환한다', () => {
    const hooks = parseHooks(SAMPLE_SETTINGS)
    const types = getUniqueEventTypes(hooks)
    expect(types).toContain('PreToolUse')
    expect(types).toContain('SessionStart')
    expect(types).toContain('Stop')
    expect(types).toHaveLength(3)
  })
})

describe('countTotalHooks', () => {
  it('전체 훅 개수를 카운트한다', () => {
    const hooks = parseHooks(SAMPLE_SETTINGS)
    // PreToolUse/Bash: 2, PreToolUse/mcp: 2, SessionStart: 2, Stop: 1 = 7
    expect(countTotalHooks(hooks)).toBe(7)
  })
})
