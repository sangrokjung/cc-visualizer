import { statSync, watch, openSync, readSync, closeSync } from 'fs'
import { join, basename } from 'path'
import { readdirSync, existsSync } from 'fs'
import type { BrowserWindow } from 'electron'

const home = process.env.HOME ?? ''

// 모듈 레벨 상태 변수
let currentJsonlPath: string | null = null
let currentWatcher: ReturnType<typeof watch> | null = null
let currentPollInterval: ReturnType<typeof setInterval> | null = null
let offset = 0

interface SessionEvent {
  id: string
  timestamp: string
  type:
    | 'user'
    | 'assistant'
    | 'tool_use'
    | 'tool_result'
    | 'agent_spawn'
    | 'agent_progress'
    | 'hook'
    | 'system'
  data: {
    text?: string
    toolName?: string
    toolInput?: string
    agentId?: string
    agentName?: string
    hookEvent?: string
    hookName?: string
    command?: string
  }
}

function findLatestJsonl(): string | null {
  const projectsDir = join(home, '.claude/projects')
  if (!existsSync(projectsDir)) return null

  let latestFile: string | null = null
  let latestMtime = 0

  try {
    const dirs = readdirSync(projectsDir)
    for (const dir of dirs) {
      const dirPath = join(projectsDir, dir)
      try {
        const files = readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'))
        for (const file of files) {
          const filePath = join(dirPath, file)
          const st = statSync(filePath)
          if (st.mtimeMs > latestMtime) {
            latestMtime = st.mtimeMs
            latestFile = filePath
          }
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }

  return latestFile
}

function extractToolUses(message: unknown): Array<{ name: string; input?: string }> {
  let obj: any = message
  if (typeof message === 'string') {
    try {
      // Python repr → JSON 변환 시도
      const jsonStr = message
        .replace(/'/g, '"')
        .replace(/True/g, 'true')
        .replace(/False/g, 'false')
        .replace(/None/g, 'null')
      obj = JSON.parse(jsonStr)
    } catch {
      // 정규식 폴백: tool_use name 추출
      const matches = [...message.matchAll(/"name":\s*"([^"]+)"|'name':\s*'([^']+)'/g)]
      return matches
        .map((m) => m[1] || m[2])
        .filter(
          (n) =>
            n &&
            !['text', 'tool_use', 'tool_result', 'user', 'assistant', 'system'].includes(n)
        )
        .map((n) => ({ name: n }))
    }
  }
  if (!obj || typeof obj !== 'object') return []

  const results: Array<{ name: string; input?: string }> = []
  const content = obj?.message?.content || obj?.content || []
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block?.type === 'tool_use' && block?.name) {
        results.push({
          name: block.name,
          input:
            typeof block.input === 'object' ? JSON.stringify(block.input).slice(0, 100) : undefined
        })
      }
    }
  }
  return results
}

function extractAgentName(prompt: string, agentId: string): string {
  if (!prompt) return agentId.slice(0, 12)
  // "당신은 X 팀의 Y입니다" 패턴
  const teamMatch = prompt.match(/팀의\s+(\S+?)입니다/)
  if (teamMatch) return teamMatch[1]
  // "You are X team's Y" 패턴
  const engMatch = prompt.match(/you are .+?'s (\S+)/i)
  if (engMatch) return engMatch[1]
  // 짧으면 그대로
  if (prompt.length <= 30) return prompt.trim()
  return agentId.slice(0, 12)
}

function parseLines(line: string): SessionEvent[] {
  try {
    const d = JSON.parse(line)
    const base = {
      id: d.uuid || crypto.randomUUID(),
      timestamp: d.timestamp || new Date().toISOString()
    }

    // Hook progress
    if (d.type === 'progress' && d.data?.type === 'hook_progress') {
      return [
        {
          ...base,
          type: 'hook',
          data: {
            hookEvent: d.data.hookEvent,
            hookName: d.data.hookName,
            command: d.data.command
          }
        }
      ]
    }

    // Agent progress — 복수 이벤트 반환
    if (d.type === 'progress' && d.data?.type === 'agent_progress') {
      const events: SessionEvent[] = []
      const agentId = d.data.agentId || ''
      const prompt = d.data.prompt || ''
      const agentName = extractAgentName(prompt, agentId)

      // 스폰 이벤트 (prompt가 있을 때)
      if (prompt.length > 0) {
        events.push({
          ...base,
          type: 'agent_spawn',
          data: { agentId, agentName }
        })
      }

      // message에서 tool_use 추출
      if (d.data.message) {
        const toolUses = extractToolUses(d.data.message)
        for (const tool of toolUses) {
          events.push({
            ...base,
            id: `${base.id}-tool-${tool.name}`,
            type: 'tool_use',
            data: {
              agentId,
              agentName,
              toolName: tool.name,
              toolInput: tool.input
            }
          })
        }

        // tool_use가 없으면 agent_progress로
        if (toolUses.length === 0 && !prompt) {
          events.push({
            ...base,
            type: 'agent_progress',
            data: {
              agentId,
              agentName,
              text: String(d.data.message).slice(0, 200)
            }
          })
        }
      }

      return events.length > 0
        ? events
        : [
            {
              ...base,
              type: 'agent_progress',
              data: { agentId, agentName }
            }
          ]
    }

    // User / Assistant / System
    if (d.type === 'user') return [{ ...base, type: 'user', data: {} }]
    if (d.type === 'assistant') return [{ ...base, type: 'assistant', data: {} }]
    if (d.type === 'system') return [{ ...base, type: 'system', data: {} }]

    return []
  } catch {
    return []
  }
}

function startWatching(mainWindow: BrowserWindow, jsonlPath: string): void {
  // 기존 cleanup
  if (currentWatcher) {
    currentWatcher.close()
    currentWatcher = null
  }
  if (currentPollInterval) {
    clearInterval(currentPollInterval)
    currentPollInterval = null
  }

  currentJsonlPath = jsonlPath
  offset = 0
  try {
    offset = statSync(jsonlPath).size
  } catch {
    /* start from 0 */
  }

  // 세션 ID 전송
  const sessionId = basename(jsonlPath, '.jsonl')
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session-id', sessionId)
  }

  console.log(`[session-watcher] 감시 시작: ${basename(jsonlPath)}`)

  const processNewLines = (): void => {
    if (mainWindow.isDestroyed()) return
    try {
      const currentSize = statSync(jsonlPath).size
      if (currentSize <= offset) return

      const fd = openSync(jsonlPath, 'r')
      const buf = Buffer.alloc(currentSize - offset)
      readSync(fd, buf, 0, buf.length, offset)
      closeSync(fd)
      offset = currentSize

      const newContent = buf.toString('utf-8')
      const lines = newContent.split('\n').filter((l) => l.trim())
      for (const line of lines) {
        const events = parseLines(line)
        for (const event of events) {
          mainWindow.webContents.send('session-event', event)
        }
      }
    } catch (err) {
      console.error('[session-watcher] 읽기 오류:', err)
    }
  }

  currentWatcher = watch(jsonlPath, { persistent: false }, () => processNewLines())
  currentPollInterval = setInterval(processNewLines, 2000)
}

function checkForNewSession(mainWindow: BrowserWindow): void {
  if (mainWindow.isDestroyed()) return
  const latest = findLatestJsonl()
  if (!latest || latest === currentJsonlPath) return

  console.log(`[session-watcher] 새 세션 감지: ${basename(latest)}`)
  startWatching(mainWindow, latest)
}

export function startSessionWatcher(mainWindow: BrowserWindow): void {
  // 초기 세션 찾기
  checkForNewSession(mainWindow)

  // 10초마다 새 세션 체크
  const sessionCheckInterval = setInterval(() => {
    if (mainWindow.isDestroyed()) {
      clearInterval(sessionCheckInterval)
      return
    }
    checkForNewSession(mainWindow)
  }, 10000)

  mainWindow.on('closed', () => {
    clearInterval(sessionCheckInterval)
    if (currentWatcher) currentWatcher.close()
    if (currentPollInterval) clearInterval(currentPollInterval)
  })
}
