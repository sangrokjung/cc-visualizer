import { readFileSync, statSync, watch } from 'fs'
import { join, basename } from 'path'
import { readdirSync, existsSync } from 'fs'
import type { BrowserWindow } from 'electron'

const home = process.env.HOME ?? ''

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

function parseLine(line: string): SessionEvent | null {
  try {
    const d = JSON.parse(line)
    const base = {
      id: d.uuid || crypto.randomUUID(),
      timestamp: d.timestamp || new Date().toISOString()
    }

    // Hook progress
    if (d.type === 'progress' && d.data?.type === 'hook_progress') {
      return {
        ...base,
        type: 'hook',
        data: {
          hookEvent: d.data.hookEvent,
          hookName: d.data.hookName,
          command: d.data.command
        }
      }
    }

    // Agent progress
    if (d.type === 'progress' && d.data?.type === 'agent_progress') {
      const isSpawn = !!d.data.prompt && d.data.prompt.length > 0
      return {
        ...base,
        type: isSpawn ? 'agent_spawn' : 'agent_progress',
        data: {
          agentId: d.data.agentId,
          agentName: d.data.prompt?.slice(0, 60) || '',
          text: d.data.message ? String(d.data.message).slice(0, 200) : undefined
        }
      }
    }

    // User message
    if (d.type === 'user') {
      return { ...base, type: 'user', data: {} }
    }

    // Assistant message
    if (d.type === 'assistant') {
      return { ...base, type: 'assistant', data: {} }
    }

    // System
    if (d.type === 'system') {
      return { ...base, type: 'system', data: {} }
    }

    return null
  } catch {
    return null
  }
}

export function startSessionWatcher(mainWindow: BrowserWindow): void {
  const jsonlPath = findLatestJsonl()
  if (!jsonlPath) {
    console.log('[session-watcher] JSONL 파일을 찾을 수 없습니다')
    // 10초마다 재시도
    setTimeout(() => startSessionWatcher(mainWindow), 10000)
    return
  }

  console.log(`[session-watcher] 감시 시작: ${basename(jsonlPath)}`)

  let offset = 0
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

  const processNewLines = (): void => {
    if (mainWindow.isDestroyed()) return
    try {
      const currentSize = statSync(jsonlPath).size
      if (currentSize <= offset) return

      const content = readFileSync(jsonlPath, 'utf-8')
      const newContent = content.slice(offset)
      offset = currentSize

      const lines = newContent.split('\n').filter((l) => l.trim())
      for (const line of lines) {
        const event = parseLine(line)
        if (event) {
          mainWindow.webContents.send('session-event', event)
        }
      }
    } catch (err) {
      console.error('[session-watcher] 읽기 오류:', err)
    }
  }

  // fs.watch로 파일 변경 감지
  watch(jsonlPath, { persistent: false }, () => {
    processNewLines()
  })

  // 폴백: 2초마다 폴링
  setInterval(processNewLines, 2000)
}
